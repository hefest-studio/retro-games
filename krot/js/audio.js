/* ==========================================================================
 * DIGGER — js/audio.js : 8-битная музыка и звуковые эффекты на чистом WebAudio
 * --------------------------------------------------------------------------
 * Никаких внешних файлов, сэмплов и библиотек: всё синтезируется на лету.
 * Инструменты: pulse/square, triangle-бас, «колокольчики», белый шум
 * (для барабанов, копания и взрывов). Мелодии — оригинальные, сочинены
 * специально для этого порта (никаких чужих тем вроде Popcorn / William Tell).
 *
 * Схема графа:
 *   AudioContext
 *     └─ masterGain ───────────────► destination      (общая громкость / mute)
 *          ├─ musicBus ─► trackGain ─► голоса музыки  (плавные fade трека)
 *          └─ sfxBus   ─► голоса эффектов
 *
 * Музыка играется lookahead-планировщиком: setInterval каждые 25 мс,
 * горизонт планирования 0.12 с. Планировщик лишь расставляет ноты WebAudio
 * заранее, поэтому ритм не «плывёт» от джиттера таймеров.
 *
 * Публичный API (DG.audio) — см. CONTRACT.md §6.3:
 *   unlock(), isReady(), startMusic(mode), stopMusic(fadeMs), setGameTheme(i),
 *   sfx(name), setMuted(m), toggleMuted(), getMuted(), setVolume(v), getVolume(),
 *   setMusicEnabled(b), getMusicEnabled(), setSfxEnabled(b), getSfxEnabled().
 * ========================================================================== */
(function (global) {
  'use strict';

  var DG = global.DG = global.DG || {};

  /* ====================================================================== */
  /* 1. Константы и модульное состояние                                     */
  /* ====================================================================== */

  var LOOKAHEAD = 0.12;      // горизонт планирования музыки, секунды
  var TICK_MS = 25;          // период планировщика, мс

  var MUSIC_BUS_GAIN = 0.5;  // музыка намеренно тише SFX
  var SFX_BUS_GAIN = 0.9;
  var DEFAULT_VOLUME = 0.8;
  var MAX_PENDING_SFX = 8;   // сколько звуков запомнить до unlock
  var BAR_STEPS = 16;        // шагов (16-х) в одном такте

  var ctx = null;            // AudioContext, создаётся только по жесту
  var masterGain = null;     // общая громкость + mute
  var musicBus = null;       // шин музыки
  var sfxBus = null;         // шин эффектов
  var noiseBuf = null;       // общий буфер белого шума

  var volume = DEFAULT_VOLUME;
  var muted = false;         // общий mute (masterGain = 0)
  var musicEnabled = true;   // отдельный выключатель музыки
  var sfxEnabled = true;     // отдельный выключатель эффектов
  var gameTheme = 0;         // 0|1 — вариация игровой темы

  var current = null;        // играющий музыкальный трек
  var wantedMusic = null;    // последний запрошенный режим музыки
  var pendingMusic = null;   // запрошенная до unlock музыка
  var pendingSfx = [];       // эффекты, нажатые до unlock
  var tickTimer = null;      // setInterval планировщика

  function noop() {}

  function clamp(v, a, b) {
    v = Number(v);
    if (!isFinite(v)) return a;
    return v < a ? a : (v > b ? b : v);
  }

  function midiToFreq(midi) {
    return 440 * Math.pow(2, (midi - 69) / 12);
  }

  /* ====================================================================== */
  /* 2. AudioContext, громкость, mute, unlock                               */
  /* ====================================================================== */

  function createContext() {
    var Ctor = global.AudioContext || global.webkitAudioContext;
    if (!Ctor) return false;
    try {
      ctx = new Ctor();
      masterGain = ctx.createGain();
      masterGain.gain.value = muted ? 0 : volume;
      masterGain.connect(ctx.destination);

      musicBus = ctx.createGain();
      musicBus.gain.value = musicEnabled ? MUSIC_BUS_GAIN : 0;
      musicBus.connect(masterGain);

      sfxBus = ctx.createGain();
      sfxBus.gain.value = sfxEnabled ? SFX_BUS_GAIN : 0;
      sfxBus.connect(masterGain);
      return true;
    } catch (e) {
      ctx = null;
      masterGain = null;
      musicBus = null;
      sfxBus = null;
      return false;
    }
  }

  // Плавно применяет текущие volume/muted к masterGain (без щелчков).
  function applyMasterVolume(immediate) {
    if (!ctx || !masterGain) return;
    var target = muted ? 0 : volume;
    var now = ctx.currentTime;
    var fade = immediate ? 0.012 : 0.045;
    var g = masterGain.gain;
    try {
      if (typeof g.cancelAndHoldAtTime === 'function') g.cancelAndHoldAtTime(now);
      else { g.cancelScheduledValues(now); g.setValueAtTime(g.value, now); }
      g.linearRampToValueAtTime(target, now + fade);
    } catch (e) {
      try { g.value = target; } catch (e2) {}
    }
  }

  // Плавно включает/выключает шин музыки (SFX не затрагивает).
  function applyMusicBus() {
    if (!ctx || !musicBus) return;
    var now = ctx.currentTime;
    var target = musicEnabled ? MUSIC_BUS_GAIN : 0;
    var g = musicBus.gain;
    try {
      if (typeof g.cancelAndHoldAtTime === 'function') g.cancelAndHoldAtTime(now);
      else { g.cancelScheduledValues(now); g.setValueAtTime(g.value, now); }
      g.linearRampToValueAtTime(target, now + 0.05);
    } catch (e) {
      try { g.value = target; } catch (e2) {}
    }
  }

  function applySfxBus() {
    if (!ctx || !sfxBus) return;
    var now = ctx.currentTime;
    var target = sfxEnabled ? SFX_BUS_GAIN : 0;
    var g = sfxBus.gain;
    try {
      if (typeof g.cancelAndHoldAtTime === 'function') g.cancelAndHoldAtTime(now);
      else { g.cancelScheduledValues(now); g.setValueAtTime(g.value, now); }
      g.linearRampToValueAtTime(target, now + 0.03);
    } catch (e) {
      try { g.value = target; } catch (e2) {}
    }
  }

  // Пробуем разбудить контекст после жеста; после resume доигрываем отложенное.
  function tryResume() {
    if (!ctx || typeof ctx.resume !== 'function') return;
    try {
      var p = ctx.resume();
      if (p && typeof p.then === 'function') p.then(flushPending, noop);
    } catch (e) { /* контекст уже запущен или недоступен — не страшно */ }
  }

  // Всё, что накопилось до первого жеста: музыка и (немного) SFX.
  function flushPending() {
    if (!ctx) return;
    var list = pendingSfx;
    pendingSfx = [];
    for (var i = 0; i < list.length; i++) {
      try { playSfx(list[i]); } catch (e) {}
    }
    if (pendingMusic) {
      var mode = pendingMusic;
      pendingMusic = null;
      startMusic(mode);
    }
  }

  function unlock() {
    try {
      if (!ctx && !createContext()) return false;
      if (muted) { try { masterGain.gain.value = 0; } catch (e) {} }
      if (ctx.state === 'running') {
        flushPending();
      } else {
        tryResume();
      }
      return true;
    } catch (e) {
      return false;
    }
  }

  function isReady() {
    return !!(ctx && ctx.state !== 'closed');
  }

  /* ====================================================================== */
  /* 3. Низкоуровневый синтез: тон и шум                                    */
  /* ====================================================================== */

  function ensureNoise() {
    if (noiseBuf || !ctx) return noiseBuf;
    try {
      var len = Math.max(1, Math.floor(ctx.sampleRate * 0.5));
      var buf = ctx.createBuffer(1, len, ctx.sampleRate);
      var data = buf.getChannelData(0);
      var s = 0x9e3779b9;
      for (var i = 0; i < len; i++) {
        // Детерминированный белый шум (xorshift) — стабильно и без Math.random в цикле.
        s ^= s << 13; s ^= s >>> 17; s ^= s << 5;
        data[i] = ((s >>> 0) / 2147483648) - 1;
      }
      noiseBuf = buf;
    } catch (e) { noiseBuf = null; }
    return noiseBuf;
  }

  // Один тон с ADSR-подобной огибающей. voices — Set активных источников
  // (для музыки, чтобы потом аккуратно остановить трек).
  function tone(bus, opt, voices) {
    if (!ctx || !bus || !opt) return null;
    var t0 = Math.max(opt.t == null ? ctx.currentTime : opt.t, ctx.currentTime);
    var dur = opt.dur > 0.012 ? opt.dur : 0.012;
    var vol = opt.vol == null ? 0.2 : opt.vol;
    if (!(vol > 0.0002)) return null;

    var osc = null;
    var gain = null;
    try {
      osc = ctx.createOscillator();
      gain = ctx.createGain();
    } catch (e) { return null; }

    osc.type = opt.type || 'square';
    var f0 = Math.max(20, opt.f0 || 440);
    try {
      osc.frequency.setValueAtTime(f0, t0);
      if (opt.f1 != null) {
        var glide = opt.glide == null ? 1 : clamp(opt.glide, 0.05, 1);
        osc.frequency.exponentialRampToValueAtTime(Math.max(20, opt.f1), t0 + dur * glide);
      }
    } catch (e2) {}

    var atk = Math.min(opt.attack == null ? 0.006 : opt.attack, dur * 0.4);
    var sus = clamp(opt.sustain == null ? 0.6 : opt.sustain, 0, 0.85);
    try {
      var g = gain.gain;
      g.setValueAtTime(0.0001, t0);
      g.linearRampToValueAtTime(vol, t0 + atk);
      var decayAt = t0 + Math.max(atk, dur * sus);
      if (decayAt < t0 + dur - 0.004) {
        g.setValueAtTime(vol, decayAt);
        g.exponentialRampToValueAtTime(0.0004, t0 + dur);
      }
      g.setValueAtTime(0, t0 + dur); // после огибающей — гарантированно тишина
    } catch (e3) {}

    try {
      osc.connect(gain);
      gain.connect(bus);
      osc.start(t0);
      osc.stop(t0 + dur + 0.03);
    } catch (e4) { return null; }

    osc.onended = function () {
      try { osc.disconnect(); } catch (e) {}
      try { gain.disconnect(); } catch (e) {}
      if (voices) voices.delete(osc);
    };
    if (voices) voices.add(osc);
    return osc;
  }

  // Короткий шумовой «удар» с фильтром (барабаны, взрывы, копание).
  function noise(bus, opt, voices) {
    if (!ctx || !bus || !opt) return null;
    var buf = ensureNoise();
    if (!buf) return null;
    var t0 = Math.max(opt.t == null ? ctx.currentTime : opt.t, ctx.currentTime);
    var dur = opt.dur > 0.012 ? opt.dur : 0.012;
    var vol = opt.vol == null ? 0.2 : opt.vol;
    if (!(vol > 0.0002)) return null;

    var src = null;
    var filter = null;
    var gain = null;
    try {
      src = ctx.createBufferSource();
      src.buffer = buf;
      filter = ctx.createBiquadFilter();
      gain = ctx.createGain();
    } catch (e) { return null; }

    try {
      src.loop = true; // буфер короткий, но шум может понадобиться длиннее
      filter.type = opt.filter || 'lowpass';
      filter.frequency.setValueAtTime(Math.max(30, opt.f0 || 1500), t0);
      if (opt.f1 != null) {
        filter.frequency.exponentialRampToValueAtTime(Math.max(30, opt.f1), t0 + dur);
      }
      filter.Q.value = opt.q == null ? 1 : opt.q;
    } catch (e2) {}

    var atk = Math.min(opt.attack == null ? 0.003 : opt.attack, dur * 0.5);
    try {
      var g = gain.gain;
      g.setValueAtTime(0.0001, t0);
      g.linearRampToValueAtTime(vol, t0 + atk);
      g.exponentialRampToValueAtTime(0.0004, t0 + dur);
      g.setValueAtTime(0, t0 + dur);
    } catch (e3) {}

    try {
      src.connect(filter);
      filter.connect(gain);
      gain.connect(bus);
      src.start(t0);
      src.stop(t0 + dur + 0.03);
    } catch (e4) { return null; }

    src.onended = function () {
      try { src.disconnect(); } catch (e) {}
      try { filter.disconnect(); } catch (e) {}
      try { gain.disconnect(); } catch (e) {}
      if (voices) voices.delete(src);
    };
    if (voices) voices.add(src);
    return src;
  }

  /* ====================================================================== */
  /* 4. Барабаны (шумовые) — общие для музыки и «тяжёлых» эффектов          */
  /* ====================================================================== */

  function drumKick(bus, t, vol, voices) {
    tone(bus, {
      t: t, type: 'sine', f0: 155, f1: 44, glide: 0.6,
      dur: 0.13, vol: 0.5 * vol, attack: 0.002, sustain: 0.12
    }, voices);
    noise(bus, { t: t, dur: 0.018, vol: 0.12 * vol, filter: 'highpass', f0: 2400, q: 0.7 }, voices);
  }

  function drumSnare(bus, t, vol, voices) {
    noise(bus, { t: t, dur: 0.14, vol: 0.2 * vol, filter: 'bandpass', f0: 1900, q: 0.9 }, voices);
    tone(bus, { t: t, type: 'triangle', f0: 215, f1: 130, dur: 0.07, vol: 0.12 * vol, sustain: 0.35 }, voices);
  }

  function drumHat(bus, t, vol, open, voices) {
    noise(bus, {
      t: t, dur: open ? 0.13 : 0.035,
      vol: (open ? 0.085 : 0.07) * vol,
      filter: 'highpass', f0: open ? 6200 : 8000, q: 0.8
    }, voices);
  }

  function playDrumHit(bus, kind, t, vol, voices) {
    if (kind === 'k') drumKick(bus, t, vol, voices);
    else if (kind === 's') drumSnare(bus, t, vol, voices);
    else if (kind === 'h') drumHat(bus, t, vol, false, voices);
    else if (kind === 'o') drumHat(bus, t, vol, true, voices);
  }

  /* ====================================================================== */
  /* 5. Звуковые эффекты (SFX)                                              */
  /* ====================================================================== */

  // Список ровно по контракту §6.3. Каждая функция создаёт ноды мгновенно
  // (t — стартовое время в шкале AudioContext) и ничего не возвращает.
  var SFX_FNS = {
    // копание: короткий хруст земли
    dig: function (t) {
      noise(sfxBus, { t: t, dur: 0.055, vol: 0.22, filter: 'lowpass', f0: 1500, f1: 320, q: 0.8 });
      tone(sfxBus, { t: t, type: 'square', f0: 135, f1: 68, dur: 0.05, vol: 0.1, sustain: 0.2 });
    },

    // алмаз: тонкий двухнотный «блик»
    gem: function (t) {
      tone(sfxBus, { t: t, type: 'square', f0: midiToFreq(88), dur: 0.055, vol: 0.12, sustain: 0.3 });
      tone(sfxBus, { t: t + 0.055, type: 'square', f0: midiToFreq(95), dur: 0.1, vol: 0.11, sustain: 0.2 });
    },

    // золото: восходящее арпеджио + искры
    gold: function (t) {
      var notes = [72, 76, 79, 84];
      for (var i = 0; i < notes.length; i++) {
        tone(sfxBus, {
          t: t + i * 0.05, type: 'triangle',
          f0: midiToFreq(notes[i]), dur: 0.09, vol: 0.14, sustain: 0.25
        });
      }
      noise(sfxBus, { t: t, dur: 0.18, vol: 0.05, filter: 'highpass', f0: 5000, q: 0.7 });
    },

    // толчок мешка: глухой низкий удар
    bag_push: function (t) {
      tone(sfxBus, { t: t, type: 'square', f0: 95, f1: 65, dur: 0.11, vol: 0.16, sustain: 0.3 });
      noise(sfxBus, { t: t, dur: 0.1, vol: 0.12, filter: 'lowpass', f0: 500, f1: 180, q: 0.7 });
    },

    // мешок трясётся: дребезжащий вибрирующий тон
    bag_wobble: function (t) {
      if (!ctx || !sfxBus) return;
      var t0 = Math.max(t, ctx.currentTime);
      var dur = 0.38;
      var osc = null;
      var gain = null;
      var lfo = null;
      var lfoGain = null;
      try {
        osc = ctx.createOscillator();
        gain = ctx.createGain();
        lfo = ctx.createOscillator();
        lfoGain = ctx.createGain();
        osc.type = 'square';
        osc.frequency.setValueAtTime(185, t0);
        lfo.type = 'sine';
        lfo.frequency.setValueAtTime(13, t0);
        lfoGain.gain.setValueAtTime(45, t0);
        lfo.connect(lfoGain);
        lfoGain.connect(osc.frequency);
        gain.gain.setValueAtTime(0.0001, t0);
        gain.gain.linearRampToValueAtTime(0.085, t0 + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0004, t0 + dur);
        gain.gain.setValueAtTime(0, t0 + dur);
        osc.connect(gain);
        gain.connect(sfxBus);
        osc.start(t0); lfo.start(t0);
        osc.stop(t0 + dur + 0.03); lfo.stop(t0 + dur + 0.03);
        osc.onended = function () {
          try { osc.disconnect(); } catch (e) {}
          try { gain.disconnect(); } catch (e) {}
          try { lfo.disconnect(); } catch (e) {}
          try { lfoGain.disconnect(); } catch (e) {}
        };
      } catch (e) {}
    },

    // мешок падает: нисходящий свист
    bag_fall: function (t) {
      tone(sfxBus, { t: t, type: 'square', f0: 520, f1: 105, glide: 1, dur: 0.5, vol: 0.11, sustain: 0.8 });
      noise(sfxBus, { t: t, dur: 0.45, vol: 0.06, filter: 'bandpass', f0: 1300, f1: 300, q: 1.2 });
    },

    // мешок лопнул: земляной взрыв + звон монет
    bag_break: function (t) {
      noise(sfxBus, { t: t, dur: 0.28, vol: 0.3, filter: 'lowpass', f0: 1200, f1: 150, q: 0.9 });
      tone(sfxBus, { t: t, type: 'sine', f0: 92, f1: 38, dur: 0.26, vol: 0.22, sustain: 0.25 });
      tone(sfxBus, { t: t + 0.12, type: 'triangle', f0: midiToFreq(100), dur: 0.12, vol: 0.07, sustain: 0.2 });
      tone(sfxBus, { t: t + 0.2, type: 'triangle', f0: midiToFreq(103), dur: 0.1, vol: 0.05, sustain: 0.2 });
    },

    // выстрел: резкий зип вниз
    shoot: function (t) {
      tone(sfxBus, { t: t, type: 'square', f0: 1250, f1: 175, glide: 1, dur: 0.09, vol: 0.13, sustain: 0.12 });
      noise(sfxBus, { t: t, dur: 0.035, vol: 0.07, filter: 'highpass', f0: 3000, q: 0.7 });
    },

    // смерть монстра: падающий «вой»
    monster_die: function (t) {
      tone(sfxBus, { t: t, type: 'square', f0: 760, f1: 85, glide: 1, dur: 0.3, vol: 0.13, sustain: 0.35 });
      noise(sfxBus, { t: t, dur: 0.22, vol: 0.08, filter: 'lowpass', f0: 2400, f1: 200, q: 0.8 });
    },

    // придавило мешком: сочный «чавк»
    squash: function (t) {
      noise(sfxBus, { t: t, dur: 0.16, vol: 0.24, filter: 'lowpass', f0: 900, f1: 120, q: 1 });
      tone(sfxBus, { t: t, type: 'square', f0: 175, f1: 52, glide: 1, dur: 0.13, vol: 0.12, sustain: 0.2 });
    },

    // смерть игрока: мрачная нисходящая фраза
    player_die: function (t) {
      var notes = [76, 74, 72, 71, 69];
      for (var i = 0; i < notes.length; i++) {
        tone(sfxBus, {
          t: t + i * 0.11, type: 'square',
          f0: midiToFreq(notes[i]), dur: 0.12, vol: 0.16, sustain: 0.4
        });
      }
      tone(sfxBus, { t: t + 0.6, type: 'triangle', f0: midiToFreq(45), dur: 0.6, vol: 0.2, sustain: 0.7 });
      noise(sfxBus, { t: t, dur: 0.5, vol: 0.06, filter: 'lowpass', f0: 2500, f1: 150 });
    },

    // вишня: весёлое арпеджио
    cherry: function (t) {
      var notes = [84, 88, 91, 96];
      for (var i = 0; i < notes.length; i++) {
        tone(sfxBus, {
          t: t + i * 0.05, type: 'square',
          f0: midiToFreq(notes[i]), dur: 0.07, vol: 0.13, sustain: 0.3
        });
      }
      noise(sfxBus, { t: t + 0.15, dur: 0.18, vol: 0.05, filter: 'highpass', f0: 6000, q: 0.6 });
    },

    // старт бонус-режима: торжественный разгон вверх
    bonus: function (t) {
      var notes = [72, 76, 79, 84, 88, 91, 96];
      for (var i = 0; i < notes.length; i++) {
        tone(sfxBus, {
          t: t + i * 0.055, type: 'square',
          f0: midiToFreq(notes[i]), dur: 0.09, vol: 0.12, sustain: 0.3
        });
      }
      tone(sfxBus, { t: t + 0.4, type: 'triangle', f0: midiToFreq(84), dur: 0.45, vol: 0.1, sustain: 0.7 });
    },

    // поедание монстра в бонусе: «ном-ном»
    eat: function (t) {
      tone(sfxBus, { t: t, type: 'square', f0: 320, f1: 520, glide: 1, dur: 0.055, vol: 0.12, sustain: 0.3 });
      tone(sfxBus, { t: t + 0.06, type: 'square', f0: 520, f1: 280, glide: 1, dur: 0.07, vol: 0.11, sustain: 0.2 });
    },

    // уровень пройден: фанфара
    level_clear: function (t) {
      var notes = [67, 72, 76, 79, 84];
      for (var i = 0; i < notes.length; i++) {
        tone(sfxBus, {
          t: t + i * 0.1, type: 'square',
          f0: midiToFreq(notes[i]), dur: 0.12, vol: 0.16, sustain: 0.45
        });
      }
      tone(sfxBus, { t: t + 0.5, type: 'triangle', f0: midiToFreq(72), dur: 0.4, vol: 0.14, sustain: 0.8 });
    },

    // дополнительная жизнь: узнаваемый «1-up»
    extra_life: function (t) {
      var notes = [88, 92, 95, 100];
      for (var i = 0; i < notes.length; i++) {
        tone(sfxBus, {
          t: t + i * 0.09, type: 'square',
          f0: midiToFreq(notes[i]), dur: 0.1, vol: 0.14, sustain: 0.4
        });
      }
      tone(sfxBus, { t: t + 0.36, type: 'triangle', f0: midiToFreq(100), dur: 0.3, vol: 0.1, sustain: 0.6 });
    },

    // клик по UI: короткий тик
    ui_click: function (t) {
      tone(sfxBus, { t: t, type: 'square', f0: 1500, f1: 900, dur: 0.03, vol: 0.08, sustain: 0.2 });
    },

    // пауза: двухнотный сигнал
    pause: function (t) {
      tone(sfxBus, { t: t, type: 'square', f0: midiToFreq(76), dur: 0.07, vol: 0.11, sustain: 0.3 });
      tone(sfxBus, { t: t + 0.08, type: 'square', f0: midiToFreq(69), dur: 0.1, vol: 0.11, sustain: 0.3 });
    },

    // game over: медленно опускающаяся грустная фраза + минорный аккорд
    game_over: function (t) {
      var notes = [72, 69, 65, 62];
      for (var i = 0; i < notes.length; i++) {
        tone(sfxBus, {
          t: t + i * 0.22, type: 'square',
          f0: midiToFreq(notes[i]), dur: 0.24, vol: 0.15, sustain: 0.55
        });
      }
      var chord = [53, 57, 60];
      for (var j = 0; j < chord.length; j++) {
        tone(sfxBus, {
          t: t + 0.9, type: 'triangle',
          f0: midiToFreq(chord[j]), dur: 0.9, vol: 0.09, sustain: 0.85
        });
      }
    }
  };

  function playSfx(name) {
    if (!ctx || !name) return;
    var fn = SFX_FNS[name];
    if (!fn) return;
    fn(ctx.currentTime + 0.006);
  }

  function queueSfx(name) {
    if (!SFX_FNS[name]) return;
    if (pendingSfx.length >= MAX_PENDING_SFX) return;
    pendingSfx.push(name);
  }

  function sfx(name) {
    if (!sfxEnabled || !name) return;
    try {
      if (!ctx) { queueSfx(name); return; }
      if (ctx.state !== 'running') { queueSfx(name); if (!muted) tryResume(); return; }
      playSfx(name);
    } catch (e) { /* звук никогда не должен ломать игру */ }
  }

  /* ====================================================================== */
  /* 6. Ноты, аккорды и парсер паттернов                                     */
  /* ====================================================================== */

  var NOTE_OFFSET = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

  // "C#5" / "Eb4" / "A4" -> MIDI-номер; null для мусора.
  function noteToMidi(name) {
    var m = /^([A-Ga-g])([#b]?)(-?\d+)$/.exec(name);
    if (!m) return null;
    var off = NOTE_OFFSET[m[1].toUpperCase()];
    if (m[2] === '#') off += 1;
    else if (m[2] === 'b') off -= 1;
    return (parseInt(m[3], 10) + 1) * 12 + off;
  }

  // Аккорд: "A3m", "C3", "G#2", "D3m" и т.п.
  var CHORD_QUALITY = {
    '': [0, 4, 7, 12, 16, 19],      // мажор
    'm': [0, 3, 7, 12, 15, 19],     // минор
    '7': [0, 4, 7, 10, 16, 19],
    'm7': [0, 3, 7, 10, 15, 19],
    'dim': [0, 3, 6, 12, 15, 18]
  };

  function parseChord(str) {
    var m = /^([A-Ga-g])([#b]?)(-?\d+)(.*)$/.exec(str || '');
    if (!m) return { root: 60, tones: CHORD_QUALITY[''] };
    var root = noteToMidi(m[1] + m[2] + m[3]);
    var q = CHORD_QUALITY[(m[4] || '').toLowerCase()] || CHORD_QUALITY[''];
    return { root: root == null ? 60 : root, tones: q };
  }

  // Разбор строки паттерна в массив токенов; '|' — просто визуальный разделитель.
  function tokens(line) {
    if (!line) return [];
    return String(line).trim().split(/\s+/).filter(function (s) { return s && s !== '|'; });
  }

  // Идём по токенам; '.' — пауза, '~' — продление предыдущей ноты.
  // cb(token, absoluteStepIndex, lengthInSteps) вызывается для начала ноты.
  function eachPattern(toks, baseStep, cb) {
    for (var i = 0; i < toks.length; i++) {
      var tk = toks[i];
      if (!tk || tk === '.' || tk === '~' || tk === '|') continue;
      var len = 1;
      while (i + len < toks.length && toks[i + len] === '~') len++;
      cb(tk, baseStep + i, len);
    }
  }

  /* ====================================================================== */
  /* 7. Партитуры: оригинальные 8-битные темы                               */
  /* ====================================================================== */
  /*
   * Формат темы:
   *   bpm, loop, totalBars
   *   lead  : { type, vol, sustain, bars:[ 16 токенов на такт ] }
   *   chords: [ 'E3m', ... ] — по одному аккорду на такт (циклично)
   *   bass  : { type, vol, oct, bars:[ паттерн ] }   токены: R,3,5,8,.,~
   *   arp   : { type, vol, oct, sustain, bars:[ паттерн ] }  токены: 0..5,.,~
   *   pad   : { type, vol, oct, bars:[ индексы тактов ] } — длинный аккорд
   *   drums : { vol, bars:[ 'k . h . s . h . ...' ] }
   * Токены барабанов: k — бочка, s — малый, h — хэт, o — открытый хэт, '.' — пауза.
   * Все бар-строки строго по 16 шагов (16-е доли).
   */

  var SONG_DEFS = {

    /* ------------------------------------------------------------------
     * TITLE — медленная, загадочная тема (ля минор, 96 BPM)
     * ------------------------------------------------------------------ */
    title: {
      bpm: 96, loop: true, totalBars: 8,
      lead: {
        type: 'triangle', vol: 0.18, sustain: 0.7,
        bars: [
          'A4 ~ ~ ~ . . . . C5 ~ ~ ~ . . . .',
          'E5 ~ ~ ~ ~ ~ . . D5 ~ ~ ~ . . . .',
          'C5 ~ ~ ~ . . . . B4 ~ ~ ~ ~ ~ . .',
          'A4 ~ ~ ~ ~ ~ ~ ~ . . . . . . . .',
          'A4 ~ ~ ~ . . . . C5 ~ ~ ~ . . . .',
          'F5 ~ ~ ~ ~ ~ . . E5 ~ ~ ~ . . . .',
          'D5 ~ ~ ~ . . . . C5 ~ ~ ~ ~ ~ ~ ~',
          'B4 ~ ~ ~ ~ ~ ~ ~ . . . . . . . .'
        ]
      },
      chords: ['A3m', 'F3', 'D3m', 'E3', 'A3m', 'F3', 'D3m', 'E3'],
      bass: {
        type: 'triangle', vol: 0.34, oct: -12,
        bars: ['R ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ 5 ~ ~ ~']
      },
      arp: {
        type: 'triangle', vol: 0.085, oct: 12, sustain: 0.05,
        bars: ['0 ~ ~ ~ . . 2 ~ ~ ~ . . 4 ~ ~ ~']
      },
      drums: {
        vol: 0.32,
        bars: ['k . . . . . . . h . . . . . . .']
      }
    },

    /* ------------------------------------------------------------------
     * GAME A — энергичная тема уровня (ми минор, 140 BPM)
     * пунч: бочка/малый + стаккато-бас + арпеджио, lead-хук.
     * ------------------------------------------------------------------ */
    game_a: {
      bpm: 140, loop: true, totalBars: 8,
      lead: {
        type: 'square', vol: 0.13, sustain: 0.5,
        bars: [
          'E5 . E5 . G5 . . E5 B5 . A5 . G5 . E5 .',
          'D5 . E5 . G5 . A5 . B5 ~ . . A5 . G5 .',
          'E5 . G5 . B5 . D6 . B5 . A5 . G5 . A5 .',
          'B5 ~ . . A5 . G5 . E5 . D5 . E5 . . .',
          'E5 . E5 . G5 . . E5 B5 . A5 . G5 . E5 .',
          'D5 . E5 . G5 . A5 . B5 ~ . . A5 . G5 .',
          'C6 . B5 . A5 . G5 . A5 . G5 . E5 . D5 .',
          'E5 ~ . . ~ . . . B4 . D5 . E5 . G5 .'
        ]
      },
      chords: ['E3m', 'E3m', 'C3', 'D3', 'E3m', 'E3m', 'C3', 'B2'],
      bass: {
        type: 'triangle', vol: 0.5, oct: -12,
        bars: [
          'R . R . 5 . R . R . 5 . R . R .',
          'R . R . 5 . R . . R . 5 R . R .'
        ]
      },
      arp: {
        type: 'square', vol: 0.05, oct: 12, sustain: 0.22,
        bars: [
          '0 2 1 3 0 2 1 3 2 4 3 5 2 4 3 5',
          '0 . 2 . 1 . 3 . 0 . 2 . 1 . 3 .'
        ]
      },
      drums: {
        vol: 0.85,
        bars: [
          'k . h . s . h . k . h . s . h .',
          'k . h k s . h . k . h . s s h h'
        ]
      }
    },

    /* ------------------------------------------------------------------
     * GAME B — вторая тема уровня (ля минор, 138 BPM), другой рисунок
     * ------------------------------------------------------------------ */
    game_b: {
      bpm: 138, loop: true, totalBars: 8,
      lead: {
        type: 'square', vol: 0.13, sustain: 0.5,
        bars: [
          'A4 . C5 . E5 . A5 . G5 . E5 . C5 . A4 .',
          'F4 . A4 . C5 . F5 . E5 . C5 . A4 . F4 .',
          'G4 . C5 . E5 . G5 . E5 . C5 . G4 . E4 .',
          'A4 . E5 . A5 . ~ . G5 . E5 . D5 . C5 .',
          'A4 . C5 . E5 . A5 . G5 . E5 . C5 . A4 .',
          'F4 . A4 . C5 . F5 . E5 . C5 . A4 . F4 .',
          'G4 . C5 . E5 . G5 . A5 . G5 . E5 . C5 .',
          'A4 ~ . . . E5 . . D5 . C5 . B4 . A4 .'
        ]
      },
      chords: ['A3m', 'F3', 'C4', 'G3', 'A3m', 'F3', 'G3', 'E3'],
      bass: {
        type: 'triangle', vol: 0.5, oct: -12,
        bars: [
          'R . R . R . R . R . R . R . 5 .',
          'R . R R . R . R R . R . R . 5 .'
        ]
      },
      arp: {
        type: 'square', vol: 0.05, oct: 12, sustain: 0.22,
        bars: [
          '0 1 2 1 0 1 2 1 3 4 5 4 3 4 5 4',
          '3 . 2 . 1 . 0 . 3 . 2 . 1 . 0 .'
        ]
      },
      drums: {
        vol: 0.85,
        bars: [
          'k . h . s . h . k . h . s . h .',
          'k . k h s . h . k . k h s s h h'
        ]
      }
    },

    /* ------------------------------------------------------------------
     * BONUS — быстрая погоня (до минор, 168 BPM)
     * ------------------------------------------------------------------ */
    bonus: {
      bpm: 168, loop: true, totalBars: 8,
      lead: {
        type: 'square', vol: 0.14, sustain: 0.45,
        bars: [
          'C5 . C5 . D#5 . C5 . F5 . D#5 . C5 . G4 .',
          'C5 . C5 . D#5 . C5 . G5 . F5 . D#5 . C5 .',
          'G#4 . G#4 . C5 . G#4 . D#5 . C5 . G#4 . A#4 .',
          'A#4 . A#4 . D5 . A#4 . F5 . D#5 . A#4 . G4 .',
          'C5 . C5 . D#5 . C5 . F5 . D#5 . C5 . G4 .',
          'C5 . C5 . D#5 . C5 . G5 . F5 . D#5 . C5 .',
          'G#4 . C5 . D#5 . G5 . A#5 . G5 . D#5 . C5 .',
          'G4 ~ . . D5 ~ . . G4 ~ ~ ~ . . . .'
        ]
      },
      chords: ['C3m', 'C3m', 'G#2', 'A#2', 'C3m', 'C3m', 'G#2', 'G2'],
      bass: {
        type: 'triangle', vol: 0.52, oct: -12,
        bars: [
          'R . R . R . R . R . R . R . 5 .',
          'R . R R . R . R R . R . R . 5 .'
        ]
      },
      arp: {
        type: 'square', vol: 0.045, oct: 12, sustain: 0.18,
        bars: ['0 1 2 3 4 3 2 1 0 1 2 3 4 5 4 3']
      },
      drums: {
        vol: 0.9,
        bars: [
          'k h s h k h s h k h s h k s h s',
          'k h s h k h s h k k s h k s s s'
        ]
      }
    },

    /* ------------------------------------------------------------------
     * DEATH — короткий мрачный джингл (не луп): хроматический спуск
     * ------------------------------------------------------------------ */
    death: {
      bpm: 120, loop: false, totalBars: 1,
      lead: {
        type: 'square', vol: 0.16, sustain: 0.5,
        bars: ['D5 ~ . . C#5 ~ . . C5 ~ . . B4 ~ ~ ~']
      },
      chords: ['D3m'],
      bass: {
        type: 'triangle', vol: 0.5, oct: -12,
        bars: ['R ~ ~ ~ ~ ~ ~ ~ . . . . R ~ ~ ~']
      },
      pad: { type: 'triangle', vol: 0.045, oct: 0, bars: [0] },
      drums: {
        vol: 0.8,
        bars: ['k . . . . . . . s . . . k . . .']
      }
    },

    /* ------------------------------------------------------------------
     * CLEAR — фанфара (не луп): до-мажор, восходящие ходы
     * ------------------------------------------------------------------ */
    clear: {
      bpm: 150, loop: false, totalBars: 2,
      lead: {
        type: 'square', vol: 0.17, sustain: 0.55,
        bars: [
          'C5 . E5 . G5 . C6 ~ . . G5 . C6 ~ ~ ~',
          '~ . . . A5 . C6 . E6 ~ ~ ~ . . . .'
        ]
      },
      chords: ['C3', 'F3'],
      bass: {
        type: 'triangle', vol: 0.45, oct: -12,
        bars: ['R ~ ~ . . . 5 ~ ~ . . . R ~ ~ ~']
      },
      arp: {
        type: 'square', vol: 0.05, oct: 12, sustain: 0.2,
        bars: ['0 . 2 . 4 . 2 . 0 . 2 . 4 . 5 .']
      },
      pad: { type: 'triangle', vol: 0.04, oct: 0, bars: [0, 1] },
      drums: {
        vol: 0.9,
        bars: ['k . . . s . . . k . . . s . s s']
      }
    },

    /* ------------------------------------------------------------------
     * GAMEOVER — короткий грустный джингл (не луп)
     * ------------------------------------------------------------------ */
    gameover: {
      bpm: 96, loop: false, totalBars: 1,
      lead: {
        type: 'triangle', vol: 0.18, sustain: 0.6,
        bars: ['E5 ~ ~ . D5 ~ ~ . C5 ~ ~ . A4 ~ ~ ~']
      },
      chords: ['A3m'],
      bass: {
        type: 'triangle', vol: 0.45, oct: -12,
        bars: ['R ~ ~ ~ ~ ~ ~ ~ . . . . . . . .']
      },
      pad: { type: 'triangle', vol: 0.05, oct: 0, bars: [0] },
      drums: {
        vol: 0.5,
        bars: ['k . . . . . . . . . . . . . . .']
      }
    }
  };

  /* ====================================================================== */
  /* 8. Сборка партитур в пословные (по шагам) списки событий                */
  /* ====================================================================== */

  var SONG_WARNINGS = [];  // ошибки авторских паттернов (проверяются тестом)
  var SONGS = {};

  function buildSong(id, def) {
    var bars = def.totalBars || 0;
    var total = bars * BAR_STEPS;
    var steps = new Array(total);
    var song = {
      id: id,
      bpm: def.bpm,
      loop: !!def.loop,
      stepDur: 60 / def.bpm / 4,
      totalSteps: total,
      steps: steps,
      leadType: def.lead ? (def.lead.type || 'square') : 'square',
      leadVol: def.lead ? (def.lead.vol == null ? 0.13 : def.lead.vol) : 0.13,
      leadSustain: def.lead && def.lead.sustain != null ? def.lead.sustain : 0.55,
      bassType: def.bass ? (def.bass.type || 'triangle') : 'triangle',
      bassVol: def.bass ? (def.bass.vol == null ? 0.45 : def.bass.vol) : 0.45,
      arpType: def.arp ? (def.arp.type || 'square') : 'square',
      arpVol: def.arp ? (def.arp.vol == null ? 0.05 : def.arp.vol) : 0.05,
      arpSustain: def.arp && def.arp.sustain != null ? def.arp.sustain : 0.2,
      padType: def.pad ? (def.pad.type || 'triangle') : 'triangle',
      padVol: def.pad ? (def.pad.vol == null ? 0.04 : def.pad.vol) : 0.04,
      drumsVol: def.drums ? (def.drums.vol == null ? 0.8 : def.drums.vol) : 0.8
    };
    song.duration = song.stepDur * total;

    function add(step, ev) {
      if (step < 0 || step >= total) return;
      var arr = steps[step];
      if (!arr) arr = steps[step] = [];
      arr.push(ev);
    }

    function checkBar(what, bi, toks) {
      if (toks.length !== BAR_STEPS) {
        SONG_WARNINGS.push(id + ': ' + what + ' bar ' + (bi + 1) + ' имеет ' + toks.length + ' токенов');
      }
    }

    // --- ведущая мелодия
    if (def.lead && def.lead.bars) {
      for (var bi = 0; bi < def.lead.bars.length; bi++) {
        var leadToks = tokens(def.lead.bars[bi]);
        checkBar('lead', bi, leadToks);
        eachPattern(leadToks, bi * BAR_STEPS, function (tk, step, len) {
          var midi = noteToMidi(tk);
          if (midi == null) { SONG_WARNINGS.push(id + ': неизвестная нота "' + tk + '"'); return; }
          add(step, { k: 'lead', midi: midi, dur: len });
        });
      }
    }

    // --- гармония: бас, арпеджио, пэд
    if (def.chords && def.chords.length) {
      for (var b = 0; b < bars; b++) {
        var chord = parseChord(def.chords[b % def.chords.length]);
        var base = b * BAR_STEPS;

        if (def.bass && def.bass.bars && def.bass.bars.length) {
          var bassToks = tokens(def.bass.bars[b % def.bass.bars.length]);
          checkBar('bass', b, bassToks);
          var bassOct = def.bass.oct == null ? -12 : def.bass.oct;
          eachPattern(bassToks, base, function (tk, step, len) {
            var midi = null;
            if (tk === 'R') midi = chord.root + bassOct;
            else if (tk === '3') midi = chord.root + bassOct + chord.tones[1];
            else if (tk === '5') midi = chord.root + bassOct + chord.tones[2];
            else if (tk === '8') midi = chord.root + bassOct + 12;
            else { SONG_WARNINGS.push(id + ': неизвестный токен баса "' + tk + '"'); return; }
            add(step, { k: 'bass', midi: midi, dur: len });
          });
        }

        if (def.arp && def.arp.bars && def.arp.bars.length) {
          var arpToks = tokens(def.arp.bars[b % def.arp.bars.length]);
          checkBar('arp', b, arpToks);
          var arpOct = def.arp.oct == null ? 12 : def.arp.oct;
          eachPattern(arpToks, base, function (tk, step, len) {
            var idx = parseInt(tk, 10);
            if (!isFinite(idx) || idx < 0 || idx >= chord.tones.length) {
              SONG_WARNINGS.push(id + ': неизвестный индекс арпеджио "' + tk + '"');
              return;
            }
            add(step, { k: 'arp', midi: chord.root + arpOct + chord.tones[idx], dur: len });
          });
        }

        if (def.pad && def.pad.bars && def.pad.bars.indexOf(b) >= 0) {
          var padOct = def.pad.oct == null ? 0 : def.pad.oct;
          for (var pi = 0; pi < 3; pi++) {
            add(base, { k: 'pad', midi: chord.root + padOct + chord.tones[pi], dur: BAR_STEPS });
          }
        }
      }
    }

    // --- барабаны (шумовые)
    if (def.drums && def.drums.bars && def.drums.bars.length) {
      for (var db = 0; db < bars; db++) {
        var drumToks = tokens(def.drums.bars[db % def.drums.bars.length]);
        checkBar('drums', db, drumToks);
        for (var di = 0; di < drumToks.length; di++) {
          var tk2 = drumToks[di];
          if (!tk2 || tk2 === '.') continue;
          add(db * BAR_STEPS + di, { k: 'drum', hit: tk2 });
        }
      }
    }

    return song;
  }

  Object.keys(SONG_DEFS).forEach(function (id) {
    try { SONGS[id] = buildSong(id, SONG_DEFS[id]); } catch (e) { SONG_WARNINGS.push(id + ': ' + e.message); }
  });

  /* ====================================================================== */
  /* 9. Планировщик музыки (lookahead)                                      */
  /* ====================================================================== */

  function resolveSongId(mode) {
    if (!mode) return null;
    if (mode === 'game') return gameTheme ? 'game_b' : 'game_a';
    if (mode === 'game_a' || mode === 'game_b') return mode;
    if (mode === 'title' || mode === 'bonus' || mode === 'death' ||
        mode === 'clear' || mode === 'gameover') return mode;
    return null;
  }

  // Ноты одного шага трека.
  function scheduleStep(tr, step, when) {
    var events = tr.song.steps[step];
    if (!events) return;
    var sd = tr.song.stepDur;
    for (var i = 0; i < events.length; i++) {
      var e = events[i];

      if (e.k === 'lead') {
        tone(tr.gain, {
          t: when, type: tr.song.leadType,
          f0: midiToFreq(e.midi), dur: e.dur * sd * 0.94,
          vol: tr.song.leadVol, sustain: tr.song.leadSustain, attack: 0.006
        }, tr.voices);

      } else if (e.k === 'bass') {
        tone(tr.gain, {
          t: when, type: tr.song.bassType,
          f0: midiToFreq(e.midi), dur: Math.max(0.04, e.dur * sd * 0.9),
          vol: tr.song.bassVol, sustain: 0.62, attack: 0.005
        }, tr.voices);

      } else if (e.k === 'arp') {
        tone(tr.gain, {
          t: when, type: tr.song.arpType,
          f0: midiToFreq(e.midi), dur: Math.max(0.03, e.dur * sd),
          vol: tr.song.arpVol, sustain: tr.song.arpSustain, attack: 0.004
        }, tr.voices);

      } else if (e.k === 'pad') {
        tone(tr.gain, {
          t: when, type: tr.song.padType,
          f0: midiToFreq(e.midi), dur: e.dur * sd * 0.98,
          vol: tr.song.padVol, sustain: 0.9, attack: 0.18
        }, tr.voices);

      } else if (e.k === 'drum' && e.hit) {
        for (var c = 0; c < e.hit.length; c++) {
          playDrumHit(tr.gain, e.hit.charAt(c), when, tr.song.drumsVol, tr.voices);
        }
      }
    }
  }

  function ensureTick() {
    if (tickTimer || !ctx) return;
    tickTimer = global.setInterval(tick, TICK_MS);
  }

  function stopTickIfIdle() {
    if (current) return;
    if (tickTimer) {
      global.clearInterval(tickTimer);
      tickTimer = null;
    }
  }

  // Не-луп джингл доиграл: даём хвосту отзвучать и аккуратно гасим трек.
  function scheduleAutoStop(tr) {
    if (tr.timer) return;
    var now = ctx.currentTime;
    var endAt = tr.startedAt + tr.song.duration + 1.5;
    var delay = Math.max(900, (endAt - now) * 1000);
    tr.timer = global.setTimeout(function () {
      tr.timer = null;
      if (current === tr) {
        current = null;
        stopTrack(tr, 450);
        stopTickIfIdle();
      }
    }, Math.max(200, delay));
  }

  function tick() {
    if (!ctx) { stopTickIfIdle(); return; }
    var tr = current;
    if (!tr || !tr.alive) { stopTickIfIdle(); return; }
    if (tr.finished) return;
    if (ctx.state !== 'running') return; // контекст спит — не копим ноты

    var song = tr.song;
    var now = ctx.currentTime;
    // Если планировщик «проспал» (фоновая вкладка) — не догоняем пачкой,
    // а мягко пересинхронизируемся, чтобы не было звукового залпа.
    if (tr.nextStepTime < now - 0.15) tr.nextStepTime = now + 0.02;

    var guard = 0;
    while (tr.alive && !tr.finished && tr.nextStepTime < now + LOOKAHEAD && guard++ < 96) {
      scheduleStep(tr, tr.step, tr.nextStepTime);
      tr.step++;
      tr.nextStepTime += song.stepDur;
      if (tr.step >= song.totalSteps) {
        if (song.loop) {
          tr.step = 0;
        } else {
          tr.finished = true;
          scheduleAutoStop(tr);
        }
      }
    }
  }

  function makeTrack(id) {
    var song = SONGS[id];
    if (!song) return null;
    var gain = null;
    try {
      gain = ctx.createGain();
      gain.gain.setValueAtTime(0.0001, ctx.currentTime);
      gain.gain.linearRampToValueAtTime(1, ctx.currentTime + 0.07); // fade-in без щелчка
      gain.connect(musicBus);
    } catch (e) { return null; }
    return {
      id: id,
      song: song,
      gain: gain,
      voices: new Set(),
      step: 0,
      nextStepTime: ctx.currentTime + 0.06,
      startedAt: ctx.currentTime,
      alive: true,
      finished: false,
      timer: null
    };
  }

  // Останавливает трек с плавным затуханием, затем освобождает ноды.
  function stopTrack(tr, fadeMs) {
    if (!tr || !tr.alive) return;
    tr.alive = false;
    if (tr.timer) { global.clearTimeout(tr.timer); tr.timer = null; }
    var now = ctx.currentTime;
    var fade = Math.max(0.015, (fadeMs == null ? 250 : fadeMs) / 1000);
    try {
      var g = tr.gain.gain;
      if (typeof g.cancelAndHoldAtTime === 'function') g.cancelAndHoldAtTime(now);
      else { g.cancelScheduledValues(now); g.setValueAtTime(g.value, now); }
      g.linearRampToValueAtTime(0, now + fade);
    } catch (e) {}
    global.setTimeout(function () {
      tr.voices.forEach(function (src) {
        try { src.stop(0); } catch (e) {}
        try { src.disconnect(); } catch (e) {}
      });
      tr.voices.clear();
      try { tr.gain.disconnect(); } catch (e) {}
    }, Math.ceil(fade * 1000) + 70);
  }

  // Внутренний запуск трека (без проверок флагов музыки).
  function startMusicInternal(mode) {
    var id = resolveSongId(mode);
    if (!id || !SONGS[id] || !ctx) return false;
    if (current && current.id === id && current.alive) return true;
    var old = current;
    current = null;
    if (old) stopTrack(old, 180); // мягкий кроссфейд с предыдущей темой
    var tr = makeTrack(id);
    if (!tr) return false;
    current = tr;
    ensureTick();
    return true;
  }

  /* ====================================================================== */
  /* 10. Публичный API музыки                                               */
  /* ====================================================================== */

  function startMusic(mode) {
    try {
      if (!mode) return false;
      if (!resolveSongId(mode)) return false;
      wantedMusic = mode; // запоминаем даже при выключенной музыке
      if (!musicEnabled) {
        // Музыка выключена пользователем — трек не запускаем.
        if (ctx && pendingMusic) pendingMusic = null;
        return true;
      }
      if (!ctx) { pendingMusic = mode; return true; } // доиграем после unlock
      pendingMusic = null;
      if (current && current.id === resolveSongId(mode) && current.alive) return true;
      return startMusicInternal(mode);
    } catch (e) { return false; }
  }

  function stopMusic(fadeMs) {
    try {
      pendingMusic = null;
      wantedMusic = null;
      if (!ctx) return;
      var old = current;
      current = null;
      if (old) stopTrack(old, fadeMs == null ? 250 : fadeMs);
      stopTickIfIdle();
    } catch (e) {}
  }

  // 0|1 — какая игровая вариация звучит. Если играет игровая тема — переключаем.
  function setGameTheme(i) {
    try {
      var n = i ? 1 : 0;
      if (n === gameTheme) return;
      gameTheme = n;
      var playingGame = current && (current.id === 'game_a' || current.id === 'game_b');
      if (playingGame) startMusic('game');
    } catch (e) {}
  }

  function setMusicEnabled(enabled) {
    try {
      var v = !!enabled;
      if (v === musicEnabled) return;
      musicEnabled = v;
      if (!ctx) return; // состояние запомнили, применится после unlock
      applyMusicBus();
      if (!v) {
        // Глушим текущий трек фейдом, но помним, что должно играть.
        var old = current;
        current = null;
        if (old) stopTrack(old, 220);
        if (tickTimer) { global.clearInterval(tickTimer); tickTimer = null; }
      } else if (wantedMusic) {
        startMusicInternal(wantedMusic);
      }
    } catch (e) {}
  }

  function getMusicEnabled() { return musicEnabled; }

  function setSfxEnabled(enabled) {
    try {
      var v = !!enabled;
      if (v === sfxEnabled) return;
      sfxEnabled = v;
      if (ctx) applySfxBus();
    } catch (e) {}
  }

  function getSfxEnabled() { return sfxEnabled; }

  function setMuted(m) {
    try {
      var v = !!m;
      if (v === muted) return;
      muted = v;
      if (ctx) applyMasterVolume();
    } catch (e) {}
  }

  function toggleMuted() {
    setMuted(!muted);
    return muted;
  }

  function getMuted() { return muted; }

  function setVolume(v) {
    try {
      volume = clamp(v, 0, 1);
      if (ctx) applyMasterVolume();
    } catch (e) {}
  }

  function getVolume() { return volume; }

  /* ====================================================================== */
  /* 11. Публичный API                                                      */
  /* ====================================================================== */

  DG.audio = {
    unlock: unlock,
    isReady: isReady,
    startMusic: startMusic,
    stopMusic: stopMusic,
    setGameTheme: setGameTheme,
    sfx: sfx,
    setMuted: setMuted,
    toggleMuted: toggleMuted,
    getMuted: getMuted,
    setVolume: setVolume,
    getVolume: getVolume,
    setMusicEnabled: setMusicEnabled,
    getMusicEnabled: getMusicEnabled,
    setSfxEnabled: setSfxEnabled,
    getSfxEnabled: getSfxEnabled
  };

  /* ====================================================================== */
  /* 12. Отладочный доступ для smoke-тестов (в обычной игре не активен)      */
  /* ====================================================================== */

  if (global.__DIGGER_AUDIO_TEST__) {
    DG.audio.__test = {
      songs: SONGS,
      warnings: SONG_WARNINGS,
      sfxNames: Object.keys(SFX_FNS),
      getCurrent: function () { return current ? { id: current.id, step: current.step, finished: !!current.finished, alive: !!current.alive } : null; },
      getWanted: function () { return wantedMusic; },
      getPending: function () { return { music: pendingMusic, sfx: pendingSfx.length }; },
      getFlags: function () {
        return {
          musicEnabled: musicEnabled, sfxEnabled: sfxEnabled, muted: muted,
          volume: volume, gameTheme: gameTheme, hasCtx: !!ctx, timer: !!tickTimer
        };
      },
      getMasterGain: function () { return masterGain ? masterGain.gain.value : null; },
      getMusicBusGain: function () { return musicBus ? musicBus.gain.value : null; }
    };
  }

})(window);

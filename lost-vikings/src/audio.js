/* LOST VIKINGS · audio — оригинальный чиптюн и SFX на WebAudio (audio-smith)
 *
 * window.LV_AUDIO:
 *   unlock(), startMusic('title'|'game'), stopMusic(), setGameTrack(0|1),
 *   sfx(name), jingle('win'|'death'|'level'|'finale'), setPaused(bool),
 *   setMuted(bool), toggleMuted(), getMuted(), setVolume(0..1), isReady()
 *
 * Только WebAudio, всё синтезируется: 2 импульсные дорожки (square),
 * треугольный бас, шумовые барабаны, эхо на DelayNode. Внешних файлов нет.
 * Все вызовы безопасны до unlock(), при повторах и при отсутствии AudioContext.
 */
(function () {
  "use strict";

  var W = (typeof window !== "undefined") ? window : (typeof self !== "undefined" ? self : null);
  if (!W) return;

  /* ─────────────────────────────── настройки ─────────────────────────────── */

  var TICK_MS = 30;            // период планировщика, мс
  var LOOKAHEAD = 0.18;        // сколько секунд вперёд планируем (контракт: ≥ 0.1)
  var MUSIC_LEVEL = 0.42;      // шина музыки — заметно ниже SFX
  var SFX_LEVEL = 0.85;        // шина эффектов
  var JINGLE_LEVEL = 0.75;     // шина джинглов
  var MUSIC_ECHO_SEND = 0.24;  // посыл в эхо
  var DEFAULT_VOLUME = 0.8;    // master 0..1
  var STEPS = 16;              // 16 шестнадцатых в такте
  var TITLE_BPM = 92;          // загадочный северный луп
  var GAME0_BPM = 140;         // энергичный игровой луп №1
  var GAME1_BPM = 132;         // энергичный игровой луп №2 (со свингом)

  /* ─────────────────────────────── состояние ─────────────────────────────── */

  var ctx = null;
  var master = null;
  var musicBus = null;
  var musicTone = null;
  var sfxBus = null;
  var jingleBus = null;
  var echoSend = null;
  var echoDelay = null;
  var echoWet = null;
  var noiseBuffer = null;

  var volume = DEFAULT_VOLUME;
  var muted = false;
  var paused = false;

  var music = {
    mode: null,          // 'title' | 'game'
    gameTrack: 0,        // индекс игрового трека
    track: null,         // текущий объект трека
    step: 0,             // следующая шестнадцатая
    nextTime: 0,         // время следующей шестнадцатой
    timer: null,         // id setInterval
    sources: []          // живые источники музыки (osc / bufferSource)
  };

  /* ─────────────────────────────── утилиты ───────────────────────────────── */

  function now() { return ctx ? ctx.currentTime : 0; }

  function clamp(value, min, max) {
    var n = Number(value);
    if (!isFinite(n)) return min;
    return n < min ? min : (n > max ? max : n);
  }

  function midiToFreq(midi) {
    return 440 * Math.pow(2, (midi - 69) / 12);
  }

  var NOTE_OFFSETS = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
  var NOTE_RE = /^([A-Ga-g])([#b]?)(-?\d)$/;

  function noteToMidi(name) {
    var m = NOTE_RE.exec(String(name));
    if (!m) return null;
    var value = NOTE_OFFSETS[m[1].toUpperCase()];
    if (value === undefined) return null;
    if (m[2] === "#") value += 1;
    else if (m[2] === "b") value -= 1;
    value += (parseInt(m[3], 10) + 1) * 12;
    return (value >= 0 && value <= 127) ? value : null;
  }

  function isNum(v) { return typeof v === "number" && isFinite(v); }

  function removeMusicSource(src) {
    var idx = music.sources.indexOf(src);
    if (idx >= 0) music.sources.splice(idx, 1);
  }

  function disconnectAll(nodes) {
    for (var i = 0; i < nodes.length; i++) {
      try { if (nodes[i] && nodes[i].disconnect) nodes[i].disconnect(); } catch (e) {}
    }
  }

  // Источник музыки: следим, чтобы stop() был вызван, и чистим граф по onended.
  function trackMusicSource(src, nodes) {
    music.sources.push(src);
    try {
      src.onended = function () {
        removeMusicSource(src);
        disconnectAll(nodes);
      };
    } catch (e) {}
  }

  // Короткоживущий источник (SFX / джингл): только очистка графа.
  function trackTempSource(src, nodes) {
    try {
      src.onended = function () { disconnectAll(nodes); };
    } catch (e) {}
  }

  function stopSourceSafe(src, when) {
    try { if (src && src.stop) src.stop(when); } catch (e) {}
  }

  function stopAllMusicSources(when) {
    var list = music.sources;
    music.sources = [];
    for (var i = 0; i < list.length; i++) stopSourceSafe(list[i], when);
  }

  /* Плавная установка gain с защитой от конфликтов автоматизации */
  function rampGain(node, target, seconds) {
    if (!ctx || !node) return;
    var t = now();
    try {
      var p = node.gain;
      p.cancelScheduledValues(t);
      p.setValueAtTime(p.value, t);
      p.linearRampToValueAtTime(target, t + Math.max(0.01, seconds));
    } catch (e) {
      try { node.gain.value = target; } catch (e2) {}
    }
  }

  function setMusicLevel(level, seconds) {
    rampGain(musicBus, level, seconds == null ? 0.3 : seconds);
  }

  function applyMaster(seconds) {
    rampGain(master, muted ? 0 : volume, seconds == null ? 0.08 : seconds);
  }

  /* ─────────────────────────────── AudioContext ──────────────────────────── */

  function buildGraph() {
    master = ctx.createGain();
    master.gain.value = 0;
    master.connect(ctx.destination);

    musicTone = ctx.createBiquadFilter();
    musicTone.type = "lowpass";
    musicTone.frequency.value = 5200;
    musicTone.Q.value = 0.4;

    musicBus = ctx.createGain();
    musicBus.gain.value = 0;
    musicBus.connect(musicTone);
    musicTone.connect(master);

    sfxBus = ctx.createGain();
    sfxBus.gain.value = SFX_LEVEL;
    sfxBus.connect(master);

    jingleBus = ctx.createGain();
    jingleBus.gain.value = JINGLE_LEVEL;
    jingleBus.connect(master);

    // эхо-линия для лида и атмосферы
    echoSend = ctx.createGain();
    echoSend.gain.value = MUSIC_ECHO_SEND;
    echoDelay = ctx.createDelay(1.0);
    echoDelay.delayTime.value = 0.27;

    var feedback = ctx.createGain();
    feedback.gain.value = 0.28;

    var echoTone = ctx.createBiquadFilter();
    echoTone.type = "lowpass";
    echoTone.frequency.value = 1900;

    echoWet = ctx.createGain();
    echoWet.gain.value = 0.55;

    echoSend.connect(echoDelay);
    echoDelay.connect(echoTone);
    echoTone.connect(feedback);
    feedback.connect(echoDelay);
    echoTone.connect(echoWet);
    echoWet.connect(musicBus);
  }

  function destroyContext() {
    try { if (ctx && ctx.close) ctx.close(); } catch (e) {}
    ctx = null;
    master = null;
    musicBus = null;
    musicTone = null;
    sfxBus = null;
    jingleBus = null;
    echoSend = null;
    echoDelay = null;
    echoWet = null;
    noiseBuffer = null;
    music.sources = [];
  }

  function ensureContext() {
    if (ctx && ctx.state === "closed") destroyContext();
    if (ctx) {
      if (ctx.state === "suspended" && ctx.resume) {
        try {
          var p = ctx.resume();
          if (p && p.catch) p.catch(function () {});
        } catch (e) {}
      }
      return ctx;
    }
    var AC = W.AudioContext || W.webkitAudioContext;
    if (!AC) return null;
    try {
      ctx = new AC();
    } catch (e) {
      ctx = null;
      return null;
    }
    try {
      buildGraph();
    } catch (e) {
      destroyContext();
      return null;
    }
    if (ctx.state === "suspended" && ctx.resume) {
      try {
        var pr = ctx.resume();
        if (pr && pr.catch) pr.catch(function () {});
      } catch (e2) {}
    }
    applyMaster(0.05);
    return ctx;
  }

  /* ─────────────────────────────── синтез нот ────────────────────────────── */

  function getNoiseBuffer() {
    if (noiseBuffer) return noiseBuffer;
    var len = Math.max(256, Math.floor(ctx.sampleRate * 2));
    noiseBuffer = ctx.createBuffer(1, len, ctx.sampleRate);
    var data = noiseBuffer.getChannelData(0);
    var seed = 22222;
    for (var i = 0; i < len; i++) {
      seed = (seed * 16807) % 2147483647;
      data[i] = (seed / 1073741823.5) - 1;
    }
    return noiseBuffer;
  }

  /**
   * Нота: осциллятор + ADSR-огибающая.
   * opts: slideTo, slideDur, detune, attack, decay, sustain, release,
   *       echo, music, vibrato, vibratoRate
   */
  function tone(bus, type, freq, t, dur, peak, opts) {
    if (!ctx || !bus) return null;
    opts = opts || {};
    var osc = null, gainNode = null, lfo = null, lfoGain = null;
    try {
      osc = ctx.createOscillator();
      gainNode = ctx.createGain();
      var f = clamp(freq, 20, 16000);
      osc.type = type || "square";
      osc.frequency.setValueAtTime(f, t);
      if (isNum(opts.slideTo)) {
        try {
          osc.frequency.exponentialRampToValueAtTime(
            clamp(opts.slideTo, 20, 16000),
            t + Math.max(0.02, opts.slideDur != null ? opts.slideDur : dur)
          );
        } catch (eSlide) {}
      }
      if (isNum(opts.detune)) osc.detune.setValueAtTime(opts.detune, t);

      var amp = clamp(peak, 0.0002, 1);
      var attack = clamp(opts.attack != null ? opts.attack : 0.006, 0.001, 0.5);
      var release = clamp(opts.release != null ? opts.release : 0.05, 0.01, 1.2);
      var sustain = clamp(opts.sustain != null ? opts.sustain : 0.6, 0.02, 1);
      var decay = clamp(opts.decay != null ? opts.decay : 0.08, 0.005, 1);
      var end = t + Math.max(0.02, dur);
      var tA = Math.min(t + attack, end - 0.004);
      var tD = Math.min(tA + decay, end);

      gainNode.gain.setValueAtTime(0.0001, t);
      gainNode.gain.linearRampToValueAtTime(amp, tA);
      gainNode.gain.linearRampToValueAtTime(Math.max(0.0002, amp * sustain), tD);
      gainNode.gain.exponentialRampToValueAtTime(0.0001, end + release);

      osc.connect(gainNode);
      gainNode.connect(bus);
      if (opts.echo && echoSend) {
        try { gainNode.connect(echoSend); } catch (eEcho) {}
      }

      if (opts.vibrato) {
        try {
          lfo = ctx.createOscillator();
          lfoGain = ctx.createGain();
          lfo.type = "sine";
          lfo.frequency.setValueAtTime(clamp(opts.vibratoRate || 5, 1, 12), t);
          lfoGain.gain.setValueAtTime(0, t);
          lfoGain.gain.linearRampToValueAtTime(
            opts.vibrato,
            Math.min(t + 0.3, t + Math.max(0.1, dur * 0.5))
          );
          lfo.connect(lfoGain);
          lfoGain.connect(osc.detune);
          lfo.start(t);
          lfo.stop(end + release + 0.02);
          if (opts.music) trackMusicSource(lfo, [lfo, lfoGain]);
        } catch (eVib) {
          lfo = null;
          lfoGain = null;
        }
      }

      osc.start(t);
      osc.stop(end + release + 0.02);
      if (opts.music) trackMusicSource(osc, [osc, gainNode]);
      else trackTempSource(osc, [osc, gainNode]);
      return osc;
    } catch (e) {
      stopSourceSafe(osc, 0);
      disconnectAll([osc, gainNode, lfo, lfoGain]);
      return null;
    }
  }

  /**
   * Шум: bufferSource + фильтр + огибающая.
   * opts: dur, peak, filter (highpass|lowpass|bandpass), freq, q,
   *       attack, release, loop, echo, music
   */
  function noise(bus, t, opts) {
    if (!ctx || !bus) return null;
    opts = opts || {};
    var src = null, filterNode = null, gainNode = null;
    try {
      src = ctx.createBufferSource();
      filterNode = ctx.createBiquadFilter();
      gainNode = ctx.createGain();

      src.buffer = getNoiseBuffer();
      if (opts.loop) src.loop = true;

      filterNode.type = opts.filter || "highpass";
      filterNode.frequency.setValueAtTime(clamp(opts.freq || 2500, 20, 18000), t);
      if (opts.q != null && filterNode.Q) {
        filterNode.Q.setValueAtTime(clamp(opts.q, 0.0001, 30), t);
      }

      var dur = clamp(opts.dur != null ? opts.dur : 0.1, 0.01, 8);
      var peak = clamp(opts.peak != null ? opts.peak : 0.15, 0.0002, 1);
      var attack = clamp(opts.attack != null ? opts.attack : 0.004, 0.001, 3);
      var release = clamp(opts.release != null ? opts.release : 0.03, 0.01, 3);
      var end = t + dur;

      gainNode.gain.setValueAtTime(0.0001, t);
      gainNode.gain.linearRampToValueAtTime(peak, Math.min(t + attack, end));
      gainNode.gain.exponentialRampToValueAtTime(0.0001, end + release);

      src.connect(filterNode);
      filterNode.connect(gainNode);
      gainNode.connect(bus);
      if (opts.echo && echoSend) {
        try { gainNode.connect(echoSend); } catch (eEcho) {}
      }

      src.start(t);
      src.stop(end + release + 0.02);
      if (opts.music) trackMusicSource(src, [src, filterNode, gainNode]);
      else trackTempSource(src, [src, filterNode, gainNode]);
      return src;
    } catch (e) {
      stopSourceSafe(src, 0);
      disconnectAll([src, filterNode, gainNode]);
      return null;
    }
  }

  /* ─────────────────────────────── композиции ────────────────────────────── */

  var TRACK_WARNINGS = [];

  function barTokens(bar, label, barIndex) {
    var text = String(bar == null ? "" : bar).replace(/\s+/g, " ").trim();
    var toks = text ? text.split(" ") : [];
    if (toks.length !== STEPS) {
      TRACK_WARNINGS.push(label + " bar " + (barIndex + 1) + ": " + toks.length + " tokens");
    }
    return toks;
  }

  function addEvent(events, step, ev) {
    var key = String(step);
    if (!events[key]) events[key] = [];
    events[key].push(ev);
  }

  // Мелодия строчными токенами: "D4", "-" (продлить), "." (пауза).
  function addMelody(events, bars, kind, label, vel) {
    var pending = null;
    for (var b = 0; b < bars.length; b++) {
      var toks = barTokens(bars[b], label, b);
      for (var i = 0; i < STEPS; i++) {
        var tok = toks[i];
        var step = b * STEPS + i;
        if (tok === undefined) continue;
        if (tok === "-") {
          if (pending) pending.dur += 1;
          continue;
        }
        if (tok === ".") {
          pending = null;
          continue;
        }
        var midi = noteToMidi(tok);
        if (midi === null) {
          TRACK_WARNINGS.push(label + " bad note: " + tok);
          pending = null;
          continue;
        }
        var ev = { kind: kind, midi: midi, dur: 1, vel: vel || 0.85 };
        addEvent(events, step, ev);
        pending = ev;
      }
    }
  }

  // Генерация баса/арпеджио из аккордов и ритмического рисунка.
  // bass: токены — полутоны от корня (0, 7, 12); arp: индексы тонов аккорда.
  function addPattern(events, chords, patterns, kind, label, vel) {
    var pending = null;
    for (var b = 0; b < patterns.length; b++) {
      var toks = barTokens(patterns[b], label, b);
      var chord = chords[b % chords.length] || { bass: 40, arp: [60, 64, 67, 72] };
      for (var i = 0; i < STEPS; i++) {
        var tok = toks[i];
        var step = b * STEPS + i;
        if (tok === undefined) continue;
        if (tok === "-") {
          if (pending) pending.dur += 1;
          continue;
        }
        if (tok === ".") {
          pending = null;
          continue;
        }
        var n = parseInt(tok, 10);
        if (!isFinite(n)) {
          TRACK_WARNINGS.push(label + " bad step: " + tok);
          pending = null;
          continue;
        }
        var midi;
        if (kind === "bass") {
          midi = chord.bass + n;
        } else {
          var tones = chord.arp || [60, 64, 67, 72];
          midi = tones[((n % tones.length) + tones.length) % tones.length];
        }
        if (midi < 0 || midi > 127) {
          TRACK_WARNINGS.push(label + " out of range midi: " + midi);
          pending = null;
          continue;
        }
        var ev = { kind: kind, midi: midi, dur: 1, vel: vel || 0.6 };
        addEvent(events, step, ev);
        pending = ev;
      }
    }
  }

  // Барабаны: k — бочка, s — малый, h — хэт, o — открытый хэт (можно комбинировать).
  var DRUM_MAP = { k: "kick", s: "snare", h: "hat", o: "open" };

  function addDrums(events, bars, label) {
    for (var b = 0; b < bars.length; b++) {
      var toks = barTokens(bars[b], label, b);
      for (var i = 0; i < STEPS; i++) {
        var tok = toks[i];
        if (tok === undefined || tok === ".") continue;
        for (var c = 0; c < tok.length; c++) {
          var drum = DRUM_MAP[tok.charAt(c)];
          if (!drum) {
            TRACK_WARNINGS.push(label + " bad drum: " + tok);
            continue;
          }
          addEvent(events, b * STEPS + i, {
            kind: "drum",
            drum: drum,
            vel: c === 0 ? 1 : 0.8
          });
        }
      }
    }
  }

  function createTrack(opts) {
    return {
      id: opts.id,
      bpm: opts.bpm,
      stepDur: 60 / opts.bpm / 4,
      totalSteps: opts.bars * STEPS,
      events: opts.events,
      swing: opts.swing || 0,
      leadGain: opts.leadGain != null ? opts.leadGain : 0.15,
      arpGain: opts.arpGain != null ? opts.arpGain : 0.075,
      bassGain: opts.bassGain != null ? opts.bassGain : 0.28
    };
  }

  /* ── TITLE: загадочный северный луп, A minor / harmonic minor, 92 BPM ── */

  var TITLE_PROG = [
    { bass: 45, arp: [57, 60, 64, 69] }, // Am
    { bass: 41, arp: [53, 57, 60, 65] }, // F
    { bass: 38, arp: [50, 53, 57, 62] }, // Dm
    { bass: 40, arp: [52, 56, 59, 64] }, // E (гармонический минор)
    { bass: 45, arp: [57, 60, 64, 69] },
    { bass: 41, arp: [53, 57, 60, 65] },
    { bass: 43, arp: [55, 59, 62, 67] }, // G
    { bass: 40, arp: [52, 56, 59, 64] }
  ];

  var TITLE_BASS = [
    "0 - - - - - - - 7 - - - - - - -",
    "0 - - - - - - - 7 - - - - - - -",
    "0 - - - - - - - 7 - - - - - - -",
    "0 - - - - - - - 7 - - - - - - -",
    "0 - - - - - - - 7 - - - - - - -",
    "0 - - - - - - - 7 - - - - - - -",
    "0 - - - - - - - 7 - - - - - - -",
    "0 - - - - - - - 7 - - - - - - -"
  ];

  var TITLE_ARP = [
    "0 . 1 . 2 . 3 . 2 . 3 . 1 . 2 .",
    "0 . 1 . 2 . 3 . 2 . 3 . 1 . 2 .",
    "0 . 1 . 2 . 3 . 2 . 3 . 1 . 2 .",
    "0 . 1 . 2 . 3 . 2 . 3 . 1 . 2 .",
    "0 . 1 . 2 . 3 . 2 . 3 . 1 . 2 .",
    "0 . 1 . 2 . 3 . 2 . 3 . 1 . 2 .",
    "0 . 1 . 2 . 3 . 2 . 3 . 1 . 2 .",
    "0 . 1 . 2 . 3 . 2 . 3 . 1 . 2 ."
  ];

  var TITLE_LEAD = [
    "A4 - - - - - C5 - B4 - - - A4 - - -",
    "F4 - - - - - A4 - G4 - - - F4 - - -",
    "D4 - - - - - F4 - E4 - - - D4 - - -",
    "E4 - - - - - G#4 - B4 - - - - - - -",
    "A4 - - C5 - - E5 - - - D5 - C5 - - -",
    "C5 - - A4 - - F4 - - G4 - - A4 - - -",
    "B4 - - - D5 - - - G5 - - - - - - -",
    "B4 - - - - - - - E5 - - - - - - -"
  ];

  /* ── GAME 0: D minor, 140 BPM, 16 тактов, прямой драйв ── */

  var GAME0_PROG = [
    { bass: 38, arp: [62, 65, 69, 74] }, // Dm
    { bass: 38, arp: [62, 65, 69, 74] },
    { bass: 34, arp: [58, 62, 65, 70] }, // Bb
    { bass: 36, arp: [60, 64, 67, 72] }, // C
    { bass: 38, arp: [62, 65, 69, 74] },
    { bass: 38, arp: [62, 65, 69, 74] },
    { bass: 34, arp: [58, 62, 65, 70] },
    { bass: 33, arp: [57, 61, 64, 69] }, // A
    { bass: 38, arp: [62, 65, 69, 74] },
    { bass: 41, arp: [57, 60, 65, 69] }, // F
    { bass: 34, arp: [58, 62, 65, 70] },
    { bass: 36, arp: [60, 64, 67, 72] },
    { bass: 38, arp: [62, 65, 69, 74] },
    { bass: 34, arp: [58, 62, 65, 70] },
    { bass: 36, arp: [60, 64, 67, 72] },
    { bass: 33, arp: [57, 61, 64, 69] }
  ];

  var G0_RHYTHM_A = "0 . 0 . 0 . . 0 . 0 . 12 . 7 . 12";
  var G0_RHYTHM_B = "0 . 0 . 12 . . 0 . 0 . 0 . 7 . 12";
  var GAME0_BASS = [
    G0_RHYTHM_A, G0_RHYTHM_A, G0_RHYTHM_A, G0_RHYTHM_A,
    G0_RHYTHM_A, G0_RHYTHM_A, G0_RHYTHM_A, G0_RHYTHM_A,
    G0_RHYTHM_B, G0_RHYTHM_B, G0_RHYTHM_B, G0_RHYTHM_B,
    G0_RHYTHM_A, G0_RHYTHM_A, G0_RHYTHM_A, G0_RHYTHM_A
  ];

  var G0_ARP_A = "0 . 2 . 1 . 2 . 0 . 2 . 1 . 3 .";
  var G0_ARP_B = "0 . 1 . 2 . 3 . 2 . 1 . 0 . 2 .";
  var GAME0_ARP = [
    G0_ARP_A, G0_ARP_A, G0_ARP_A, G0_ARP_A,
    G0_ARP_A, G0_ARP_A, G0_ARP_A, G0_ARP_A,
    G0_ARP_B, G0_ARP_B, G0_ARP_B, G0_ARP_B,
    G0_ARP_A, G0_ARP_A, G0_ARP_A, G0_ARP_A
  ];

  var GAME0_LEAD = [
    "D4 - . . F4 - . . A4 - - - G4 - F4 -",
    "A4 - . . G4 - . . F4 - - - E4 - D4 -",
    "Bb3 - . . D4 - . . F4 - - - D4 - Bb3 -",
    "C4 - . . E4 - . . G4 - - - E4 - C4 -",
    "D4 - . . F4 - . . A4 - - - D5 - C5 -",
    "A4 - . . G4 - . . F4 - - - A4 - G4 -",
    "Bb4 - . . A4 - . . G4 - - - F4 - D4 -",
    "E4 - . . F4 - . . E4 - - - C#4 - A3 -",
    "D5 - - . C5 - - . A4 - - . F4 - A4 -",
    "C5 - - . A4 - - . F4 - - . A4 - C5 -",
    "D5 - - . C5 - - . Bb4 - - . G4 - Bb4 -",
    "E5 - - . D5 - - . C5 - - . G4 - E4 -",
    "D5 - . . F5 - . . E5 - - - D5 - C5 -",
    "Bb4 - . . D5 - . . F5 - - - D5 - Bb4 -",
    "C5 - . . E5 - . . G5 - - - E5 - C5 -",
    "D5 - - - C#5 - - - A4 - - - E4 - - -"
  ];

  var G0_D1 = "k . h . s . h . k . h k s . h .";
  var G0_D2 = "k . h . s . h . k . h . s . o .";
  var G0_F1 = "k . s . k s k s s s s s k s s s";
  var G0_F2 = "k . h . s . h k s s k s s s o .";
  var GAME0_DRUMS = [
    G0_D1, G0_D2, G0_D1, G0_D2, G0_D1, G0_D2, G0_D1, G0_F1,
    G0_D2, G0_D1, G0_D2, G0_D1, G0_D2, G0_D1, G0_D2, G0_F2
  ];

  /* ── GAME 1: E minor, 132 BPM, 16 тактов, свинг и другой грув ── */

  var GAME1_PROG = [
    { bass: 40, arp: [64, 67, 71, 76] }, // Em
    { bass: 36, arp: [60, 64, 67, 72] }, // C
    { bass: 43, arp: [59, 62, 67, 71] }, // G
    { bass: 38, arp: [62, 66, 69, 74] }, // D
    { bass: 40, arp: [64, 67, 71, 76] },
    { bass: 36, arp: [60, 64, 67, 72] },
    { bass: 33, arp: [57, 60, 64, 69] }, // Am
    { bass: 35, arp: [59, 63, 66, 71] }, // B
    { bass: 40, arp: [64, 67, 71, 76] },
    { bass: 36, arp: [60, 64, 67, 72] },
    { bass: 43, arp: [59, 62, 67, 71] },
    { bass: 38, arp: [62, 66, 69, 74] },
    { bass: 40, arp: [64, 67, 71, 76] },
    { bass: 33, arp: [57, 60, 64, 69] },
    { bass: 35, arp: [59, 63, 66, 71] },
    { bass: 35, arp: [59, 63, 66, 71] }
  ];

  var G1_P1 = "0 . . 0 . . 12 . 0 . . 0 . 7 . .";
  var G1_P2 = "0 . . 0 . 7 . . 0 . . 12 . . 7 .";
  var G1_P3 = "0 . 0 . 12 . 0 . 0 . 0 . 7 . 12 .";
  var G1_P4 = "0 . 0 . 7 . 12 . 0 . 0 . 7 . 12 .";
  var GAME1_BASS = [
    G1_P1, G1_P1, G1_P2, G1_P2, G1_P1, G1_P1, G1_P2, G1_P2,
    G1_P3, G1_P3, G1_P4, G1_P4, G1_P3, G1_P3, G1_P4, G1_P4
  ];

  var G1_ARP_A = "0 1 2 3 2 1 0 2 0 1 2 3 1 2 3 2";
  var G1_ARP_B = "0 . 0 2 1 . 2 3 0 . 0 2 1 . 2 3";
  var GAME1_ARP = [
    G1_ARP_A, G1_ARP_A, G1_ARP_A, G1_ARP_A,
    G1_ARP_A, G1_ARP_A, G1_ARP_A, G1_ARP_A,
    G1_ARP_B, G1_ARP_B, G1_ARP_B, G1_ARP_B,
    G1_ARP_B, G1_ARP_B, G1_ARP_B, G1_ARP_B
  ];

  var GAME1_LEAD = [
    "E4 - . E4 - . G4 - . A4 - - . B4 - A4",
    "B4 - - . A4 - - . G4 - . . F#4 - E4 -",
    "C5 - . C5 - . E5 - . D5 - - . C5 - B4",
    "D5 - - . C5 - - . B4 - . . A4 - F#4 -",
    "E4 - . E4 - . G4 - . B4 - - - A4 - G4",
    "C5 - - . B4 - - . A4 - . . G4 - E4 -",
    "D5 - - . B4 - - . G4 - . . A4 - B4 -",
    "B4 - - - A4 - - - G4 - - - F#4 - - -",
    "E5 - . D5 - . B4 - . E5 - - . D5 - B4",
    "G5 - - . E5 - - . C5 - . . E5 - G5 -",
    "D5 - - . B4 - - . G4 - - . A4 - B4 -",
    "A4 - - . F#4 - - . D4 - - . F#4 - A4 -",
    "E5 - . E5 - . G5 - . F#5 - - - E5 - D5",
    "C5 - . C5 - . E5 - . A5 - - - G5 - E5",
    "B4 - - . D#5 - - . F#5 - - . D#5 - B4 -",
    "B4 - - - F#5 - - - D#5 - - - B4 - - -"
  ];

  var G1_D1 = "k . h . s . h . k . h k s . o .";
  var G1_D2 = "k . h . s . h . k . h . s . h h";
  var G1_D3 = "k . h k s . h . k . h . s . o .";
  var G1_D4 = "k . h . s . h . k . h k s . h .";
  var G1_F1 = "s . s . s s s . k . s . s s k s";
  var G1_F2 = "k s k s s s s s s s o . s s s s";
  var GAME1_DRUMS = [
    G1_D1, G1_D2, G1_D3, G1_D4, G1_D1, G1_D2, G1_D3, G1_F1,
    G1_D2, G1_D3, G1_D4, G1_D1, G1_D2, G1_D3, G1_D4, G1_F2
  ];

  /* ── сборка треков ── */

  function makeTitleTrack() {
    var events = {};
    addMelody(events, TITLE_LEAD, "lead", "title.lead", 0.8);
    addPattern(events, TITLE_PROG, TITLE_BASS, "bass", "title.bass", 0.85);
    addPattern(events, TITLE_PROG, TITLE_ARP, "arp", "title.arp", 0.5);
    for (var step = 0; step < 8 * STEPS; step += 2 * STEPS) {
      addEvent(events, step, { kind: "wind", dur: 2 * STEPS, vel: 0.65 });
    }
    return createTrack({
      id: "title",
      bpm: TITLE_BPM,
      bars: 8,
      events: events,
      arpGain: 0.042,
      leadGain: 0.13
    });
  }

  function makeGame0Track() {
    var events = {};
    addMelody(events, GAME0_LEAD, "lead", "game0.lead", 0.95);
    addPattern(events, GAME0_PROG, GAME0_BASS, "bass", "game0.bass", 0.95);
    addPattern(events, GAME0_PROG, GAME0_ARP, "arp", "game0.arp", 0.55);
    addDrums(events, GAME0_DRUMS, "game0.drums");
    return createTrack({ id: "game0", bpm: GAME0_BPM, bars: 16, events: events });
  }

  function makeGame1Track() {
    var events = {};
    addMelody(events, GAME1_LEAD, "lead", "game1.lead", 0.95);
    addPattern(events, GAME1_PROG, GAME1_BASS, "bass", "game1.bass", 0.95);
    addPattern(events, GAME1_PROG, GAME1_ARP, "arp", "game1.arp", 0.55);
    addDrums(events, GAME1_DRUMS, "game1.drums");
    return createTrack({
      id: "game1",
      bpm: GAME1_BPM,
      bars: 16,
      events: events,
      swing: 0.09,
      leadGain: 0.15
    });
  }

  var TITLE_TRACK = makeTitleTrack();
  var GAME_TRACKS = [makeGame0Track(), makeGame1Track()];

  /* ── джинглы ── */

  var JINGLES = {};

  function defineJingle(name, bpm, leadBars, bassBars, opts) {
    var events = {};
    addMelody(events, leadBars, "lead", "jingle." + name + ".lead", 1);
    addMelody(events, bassBars, "bass", "jingle." + name + ".bass", 1);
    var stepDur = 60 / bpm / 4;
    var bars = leadBars.length;
    JINGLES[name] = {
      bpm: bpm,
      bars: bars,
      stepDur: stepDur,
      events: events,
      totalDur: bars * STEPS * stepDur,
      crash: !!(opts && opts.crash)
    };
  }

  defineJingle("win", 168, [
    "C5 - E5 - G5 - - - C6 - - - G5 - E5 -",
    "C6 - - - G5 - - - E5 - G5 - C6 - - -"
  ], [
    "C3 - - - G3 - - - C4 - - - G3 - - -",
    "C3 - - - E3 - - - G3 - - - C3 - - -"
  ], { crash: true });

  defineJingle("death", 96, [
    "A4 - - - G4 - - - F4 - - - E4 - - -"
  ], [
    "A2 - - - - - - - F2 - - - - - - -"
  ]);

  defineJingle("level", 150, [
    "G4 - B4 - D5 - G5 - - - F#5 - G5 - - -"
  ], [
    "G2 - - - D3 - - - G3 - - - D3 - - -"
  ]);

  defineJingle("finale", 160, [
    "D5 - F#5 - A5 - - - D6 - - - A5 - F#5 -",
    "D6 - - - A5 - - - F#5 - A5 - D6 - - -"
  ], [
    "D3 - - - A3 - - - D4 - - - A3 - - -",
    "D3 - - - F#3 - - - A3 - - - D3 - - -"
  ], { crash: true });

  /* ────────────────────────────── планировщик ────────────────────────────── */

  function getTrack() {
    if (music.mode === "title") return TITLE_TRACK;
    if (music.mode === "game") return GAME_TRACKS[music.gameTrack ? 1 : 0];
    return null;
  }

  function playDrum(kind, t, vel) {
    var v = clamp(vel, 0.2, 1);
    if (kind === "kick") {
      tone(musicBus, "triangle", 150, t, 0.13, 0.34 * v, {
        slideTo: 46, attack: 0.002, decay: 0.09, sustain: 0.4, release: 0.04, music: true
      });
    } else if (kind === "snare") {
      noise(musicBus, t, {
        dur: 0.1, peak: 0.2 * v, filter: "bandpass", freq: 1900, q: 0.9, release: 0.04, music: true
      });
      tone(musicBus, "triangle", 190, t, 0.055, 0.1 * v, {
        slideTo: 120, attack: 0.002, release: 0.03, music: true
      });
    } else if (kind === "hat") {
      noise(musicBus, t, {
        dur: 0.03, peak: 0.07 * v, filter: "highpass", freq: 7200, release: 0.02, music: true
      });
    } else if (kind === "open") {
      noise(musicBus, t, {
        dur: 0.13, peak: 0.065 * v, filter: "highpass", freq: 6000, release: 0.05, music: true
      });
    }
  }

  function playMusicEvent(track, ev, step, time) {
    var t = time + ((step % 2) ? track.swing * track.stepDur : 0);
    if (ev.kind === "lead") {
      var vib = (track.id === "title" && ev.dur >= 5) ? 6 : 0;
      tone(musicBus, "square", midiToFreq(ev.midi), t, ev.dur * track.stepDur * 0.92, track.leadGain * (ev.vel || 0.85), {
        attack: 0.008, decay: 0.1, sustain: 0.6, release: 0.07,
        echo: true, music: true, vibrato: vib, vibratoRate: 4.6
      });
    } else if (ev.kind === "arp") {
      tone(musicBus, "square", midiToFreq(ev.midi), t, ev.dur * track.stepDur * 0.72, track.arpGain * (ev.vel || 0.6), {
        attack: 0.004, decay: 0.05, sustain: 0.35, release: 0.04, music: true
      });
    } else if (ev.kind === "bass") {
      tone(musicBus, "triangle", midiToFreq(ev.midi), t, ev.dur * track.stepDur * 0.88, track.bassGain * (ev.vel || 0.8), {
        attack: 0.005, decay: 0.07, sustain: 0.7, release: 0.05, music: true
      });
    } else if (ev.kind === "drum") {
      playDrum(ev.drum, t, ev.vel || 0.8);
    } else if (ev.kind === "wind") {
      noise(musicBus, t, {
        loop: true,
        dur: ev.dur * track.stepDur,
        attack: 1.4,
        peak: 0.045 * (ev.vel || 0.6),
        release: 1.6,
        filter: "lowpass",
        freq: 430,
        q: 0.6,
        music: true
      });
    }
  }

  function scheduleStep(track, step, time) {
    var list = track.events[String(step)];
    if (!list || !list.length) return;
    for (var i = 0; i < list.length; i++) {
      try { playMusicEvent(track, list[i], step, time); } catch (e) {}
    }
  }

  function tick() {
    if (!ctx || !music.timer || paused || !music.mode) return;
    var track = getTrack();
    if (!track) return;
    var t = now();
    if (music.nextTime < t - 0.25) music.nextTime = t + 0.02; // догоняем после throttling
    var horizon = t + LOOKAHEAD;
    var guard = 0;
    while (music.nextTime < horizon && guard < 96) {
      scheduleStep(track, music.step, music.nextTime);
      music.nextTime += track.stepDur;
      music.step = (music.step + 1) % track.totalSteps;
      guard++;
    }
  }

  function startScheduler() {
    stopScheduler();
    try {
      music.timer = setInterval(tick, TICK_MS);
    } catch (e) {
      music.timer = null;
    }
    tick();
  }

  function stopScheduler() {
    if (music.timer) {
      try { clearInterval(music.timer); } catch (e) {}
      music.timer = null;
    }
  }

  function beginMusic(resetStep) {
    var track = getTrack();
    if (!track) return;
    stopScheduler();
    stopAllMusicSources(now() + 0.14);
    if (resetStep !== false) music.step = 0;
    if (music.step >= track.totalSteps) music.step = 0;
    music.track = track;
    music.nextTime = now() + 0.07;
    setMusicLevel(MUSIC_LEVEL, 0.55);
    startScheduler();
  }

  function duckMusic(duration) {
    if (!ctx || !musicBus || paused || !music.timer) return;
    try {
      var t = now();
      var p = musicBus.gain;
      p.cancelScheduledValues(t);
      p.setValueAtTime(p.value, t);
      p.linearRampToValueAtTime(MUSIC_LEVEL * 0.45, t + 0.07);
      p.linearRampToValueAtTime(MUSIC_LEVEL, t + Math.max(0.4, duration + 0.2));
    } catch (e) {}
  }

  /* ─────────────────────────────── публичное API ─────────────────────────── */

  function unlock() {
    try {
      if (!ensureContext()) return false;
      if (music.mode && !paused && !music.timer) beginMusic(true);
      return true;
    } catch (e) {
      return false;
    }
  }

  function startMusic(mode) {
    try {
      if (mode !== "title" && mode !== "game") return;
      if (music.mode !== mode) music.step = 0;
      music.mode = mode;
      if (!ctx) return;          // ждём unlock() — тогда музыка начнётся
      if (paused) return;        // возобновим в setPaused(false)
      var track = getTrack();
      if (!track) return;
      if (music.timer && music.track === track) return; // идемпотентно
      beginMusic(true);
    } catch (e) {}
  }

  function stopMusic() {
    try {
      music.mode = null;
      music.track = null;
      music.step = 0;
      stopScheduler();
      if (ctx) {
        setMusicLevel(0, 0.3);
        stopAllMusicSources(now() + 0.32);
      }
    } catch (e) {}
  }

  function setGameTrack(index) {
    try {
      var next = index ? 1 : 0;
      var changed = music.gameTrack !== next;
      music.gameTrack = next;
      if (changed && music.mode === "game" && !paused && ctx) beginMusic(true);
    } catch (e) {}
  }

  function setPaused(value) {
    try {
      var next = !!value;
      if (paused === next) return;
      paused = next;
      if (!ctx) return;
      if (paused) {
        stopScheduler();
        setMusicLevel(0, 0.12);
        stopAllMusicSources(now() + 0.18);
      } else if (music.mode) {
        var track = getTrack();
        if (!track) return;
        if (music.step >= track.totalSteps) music.step = 0;
        music.track = track;
        music.nextTime = now() + 0.05;
        setMusicLevel(MUSIC_LEVEL, 0.35);
        startScheduler();
      }
    } catch (e) {}
  }

  function playSfx(name) {
    try {
      if (!ctx || muted) return;
      var fn = SFX[name];
      if (typeof fn !== "function") return;
      fn(now() + 0.012);
    } catch (e) {}
  }

  function playJingle(name) {
    try {
      if (!ctx || muted) return;
      var def = JINGLES[name];
      if (!def) return;
      var t = now() + 0.02;
      var keys = Object.keys(def.events);
      for (var k = 0; k < keys.length; k++) {
        var step = parseInt(keys[k], 10);
        if (!isFinite(step)) continue;
        var at = t + step * def.stepDur;
        var list = def.events[keys[k]];
        for (var i = 0; i < list.length; i++) {
          var ev = list[i];
          if (ev.kind === "lead") {
            tone(jingleBus, "square", midiToFreq(ev.midi), at, ev.dur * def.stepDur * 0.94, 0.17, {
              attack: 0.006, decay: 0.08, sustain: 0.65, release: 0.08, echo: true
            });
          } else if (ev.kind === "bass") {
            tone(jingleBus, "triangle", midiToFreq(ev.midi), at, ev.dur * def.stepDur * 0.94, 0.3, {
              attack: 0.006, decay: 0.1, sustain: 0.7, release: 0.08
            });
          }
        }
      }
      if (def.crash) {
        for (var b = 0; b < def.bars; b++) {
          noise(jingleBus, t + b * STEPS * def.stepDur, {
            dur: 0.5, peak: 0.09, filter: "highpass", freq: 5000, release: 0.4, echo: true
          });
        }
      }
      duckMusic(def.totalDur + 0.2);
    } catch (e) {}
  }

  function setMuted(value) {
    try {
      muted = !!value;
      if (ctx) applyMaster(0.05);
    } catch (e) {}
  }

  function toggleMuted() {
    setMuted(!muted);
    return muted;
  }

  function getMuted() {
    return muted;
  }

  function setVolume(value) {
    try {
      if (!isFinite(Number(value))) return;
      volume = clamp(value, 0, 1);
      if (ctx) applyMaster(0.08);
    } catch (e) {}
  }

  function isReady() {
    return !!(ctx && ctx.state !== "closed");
  }

  /* ──────────────────────────────── SFX ──────────────────────────────────── */

  var SFX = {
    jump: function (t) {
      tone(sfxBus, "square", 300, t, 0.14, 0.2, {
        slideTo: 720, attack: 0.004, decay: 0.09, sustain: 0.3, release: 0.03
      });
    },
    land: function (t) {
      tone(sfxBus, "triangle", 170, t, 0.08, 0.34, {
        slideTo: 55, attack: 0.002, decay: 0.06, sustain: 0.4, release: 0.05
      });
      noise(sfxBus, t, { dur: 0.05, peak: 0.12, filter: "lowpass", freq: 700, release: 0.04 });
    },
    headbutt: function (t) {
      tone(sfxBus, "square", 150, t, 0.14, 0.26, {
        slideTo: 70, attack: 0.002, decay: 0.1, sustain: 0.4, release: 0.04
      });
      noise(sfxBus, t, { dur: 0.09, peak: 0.22, filter: "bandpass", freq: 850, q: 0.8, release: 0.04 });
    },
    break: function (t) {
      noise(sfxBus, t, { dur: 0.05, peak: 0.26, filter: "bandpass", freq: 1300, q: 0.7, release: 0.03 });
      noise(sfxBus, t + 0.05, { dur: 0.04, peak: 0.22, filter: "highpass", freq: 2200, release: 0.03 });
      noise(sfxBus, t + 0.1, { dur: 0.06, peak: 0.17, filter: "bandpass", freq: 700, q: 0.9, release: 0.05 });
      tone(sfxBus, "triangle", 220, t, 0.1, 0.2, { slideTo: 80, attack: 0.002, release: 0.04 });
    },
    arrow: function (t) {
      noise(sfxBus, t, { dur: 0.14, peak: 0.14, filter: "highpass", freq: 2600, release: 0.06 });
      tone(sfxBus, "square", 900, t, 0.09, 0.07, { slideTo: 320, attack: 0.003, release: 0.03 });
    },
    sword: function (t) {
      tone(sfxBus, "square", 1250, t, 0.1, 0.12, {
        slideTo: 740, attack: 0.002, decay: 0.07, sustain: 0.25, release: 0.04
      });
      tone(sfxBus, "triangle", 2400, t, 0.06, 0.05, { attack: 0.001, release: 0.03 });
      noise(sfxBus, t, { dur: 0.05, peak: 0.08, filter: "highpass", freq: 4200, release: 0.03 });
    },
    lever: function (t) {
      tone(sfxBus, "square", 430, t, 0.035, 0.12, { attack: 0.002, release: 0.02 });
      tone(sfxBus, "square", 190, t + 0.055, 0.06, 0.12, { attack: 0.002, release: 0.03 });
      noise(sfxBus, t + 0.045, { dur: 0.025, peak: 0.08, filter: "highpass", freq: 1800, release: 0.02 });
    },
    gate: function (t) {
      noise(sfxBus, t, { dur: 0.3, peak: 0.16, filter: "lowpass", freq: 520, release: 0.12 });
      tone(sfxBus, "triangle", 95, t, 0.28, 0.16, { slideTo: 58, attack: 0.01, release: 0.08 });
    },
    plate: function (t) {
      tone(sfxBus, "square", 720, t, 0.03, 0.08, { attack: 0.002, release: 0.02 });
      tone(sfxBus, "triangle", 360, t + 0.03, 0.05, 0.12, { attack: 0.002, release: 0.03 });
    },
    treasure: function (t) {
      var notes = [76, 79, 84, 88];
      for (var i = 0; i < notes.length; i++) {
        tone(sfxBus, "square", midiToFreq(notes[i]), t + i * 0.055, 0.13, 0.1, {
          attack: 0.003, decay: 0.05, sustain: 0.5, release: 0.06, echo: true
        });
      }
    },
    exit: function (t) {
      var notes = [72, 76, 79, 84, 88];
      for (var i = 0; i < notes.length; i++) {
        tone(sfxBus, "square", midiToFreq(notes[i]), t + i * 0.07, 0.16, 0.1, {
          attack: 0.004, decay: 0.06, sustain: 0.5, release: 0.08, echo: true
        });
      }
      tone(sfxBus, "triangle", 130, t, 0.4, 0.16, { attack: 0.01, release: 0.1 });
    },
    "switch": function (t) {
      tone(sfxBus, "square", 520, t, 0.06, 0.1, { slideTo: 860, attack: 0.003, release: 0.03 });
    },
    click: function (t) {
      tone(sfxBus, "square", 1200, t, 0.02, 0.06, { attack: 0.001, release: 0.015 });
    },
    hurt: function (t) {
      tone(sfxBus, "square", 320, t, 0.18, 0.2, {
        slideTo: 120, attack: 0.002, decay: 0.12, sustain: 0.4, release: 0.05
      });
      noise(sfxBus, t, { dur: 0.1, peak: 0.1, filter: "bandpass", freq: 800, q: 1, release: 0.05 });
    },
    death: function (t) {
      var notes = [69, 65, 62, 57];
      for (var i = 0; i < notes.length; i++) {
        tone(sfxBus, "square", midiToFreq(notes[i]), t + i * 0.13, 0.15, 0.12, {
          attack: 0.004, decay: 0.1, sustain: 0.4, release: 0.06, echo: true
        });
      }
      tone(sfxBus, "triangle", 110, t, 0.6, 0.14, { slideTo: 55, attack: 0.01, release: 0.1 });
    },
    trap: function (t) {
      noise(sfxBus, t, { dur: 0.05, peak: 0.18, filter: "highpass", freq: 3200, release: 0.03 });
      tone(sfxBus, "square", 150, t + 0.02, 0.18, 0.16, {
        slideTo: 70, attack: 0.002, release: 0.05
      });
    }
  };

  /* ─────────────────────────────── экспорт ───────────────────────────────── */

  var API = {
    unlock: unlock,
    startMusic: startMusic,
    stopMusic: stopMusic,
    setGameTrack: setGameTrack,
    sfx: playSfx,
    jingle: playJingle,
    setPaused: setPaused,
    setMuted: setMuted,
    toggleMuted: toggleMuted,
    getMuted: getMuted,
    setVolume: setVolume,
    isReady: isReady
  };

  W.LV_AUDIO = API;
})();

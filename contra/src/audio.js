/* ============================================================================
   CONTRA: НЕОНОВЫЙ РАССВЕТ — WebAudio chiptune engine (original score, no samples)
   ----------------------------------------------------------------------------
   Классический скрипт (не модуль). Единственный глобальный объект: CONTRA_AUDIO.
   Вся музыка синтезируется на лету: 2 импульсных канала (PeriodicWave 12.5%/25%),
   треугольный бас, шумовые барабаны, лёгкий эхо-посыл. Никаких файлов и сети.
   API и поведение описаны в docs/AUDIO.md. Код устойчив к отсутствию WebAudio:
   если AudioContext нет, объект всё равно создаётся, все методы молча ничего
   не делают и никогда не бросают исключений.
   ========================================================================= */
(function () {
  'use strict';

  var root = (typeof window !== 'undefined') ? window : null;
  if (!root) return;
  var doc = root.document || null;
  var AC = root.AudioContext || root.webkitAudioContext || null;

  /* =========================================================================
     0. КОНСТАНТЫ И СОСТОЯНИЕ
     ========================================================================= */
  var MASTER_VOL = 0.8;   // общая громкость по умолчанию
  var MUSIC_VOL = 0.5;    // шина музыки
  var SFX_VOL = 0.75;     // шина эффектов
  var LOOKAHEAD = 0.12;   // окно планирования, сек
  var TICK_MS = 25;       // период планировщика, мс
  var A4_HZ = 440;

  // Таймеры берём из окружения (в браузере это window.setInterval).
  // ВАЖНО: привязываем к window — вызов нативного setInterval как метода
  // постороннего объекта в Chrome бросает "Illegal invocation".
  var timers = null;
  (function () {
    var si = (typeof setInterval === 'function') ? setInterval : root.setInterval;
    var ci = (typeof clearInterval === 'function') ? clearInterval : root.clearInterval;
    if (si && ci) {
      timers = {
        set: function (fn, ms) { return si.call(root, fn, ms); },
        clear: function (id) { return ci.call(root, id); }
      };
    }
  })();

  var ctx = null;                 // AudioContext (создаётся лениво в unlock)
  var master = null;              // общий гейн (0..userVol)
  var comp = null;                // компрессор-лимитер
  var limiter = null;             // мягкий клиппер (tanh)
  var musicBus = null;            // шина музыки
  var sfxBus = null;              // шина эффектов
  var pulse12 = null, pulse25 = null; // PeriodicWave
  var noiseBuf = null;            // общий буфер шума (2 сек)

  var muted = false;
  var userVol = MASTER_VOL;
  var desired = null;             // последний запрошенный трек
  var resumePos = null;           // {name, step} — позиция для возврата после mute
  var active = [];                // звучащие и затухающие треки
  var schedTimer = null;
  var hidden = doc ? !!doc.hidden : false;
  var gestureHooks = false;
  var visibilityHook = false;
  var warnings = 0;

  var MIX_DEFAULTS = { lead: 0.42, harm: 0.14, bass: 0.4, drums: 0.46 };

  /* =========================================================================
     1. МЕЛОЧИ
     ========================================================================= */
  function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }
  function toNum(v, d) { var n = +v; return isFinite(n) ? n : d; }
  function rnd(a, b) { return a + Math.random() * (b - a); }

  function warn(msg) {
    if (warnings++ > 24) return;
    try { root.console.warn('[CONTRA_AUDIO] ' + msg); } catch (e) {}
  }

  // Разворачивает массив строк/строку в плоский список токенов.
  // Символ '|' — только визуальный разделитель тактов, в шаги не входит.
  function flatten(seq) {
    var parts = Array.isArray(seq) ? seq : [seq];
    var out = [];
    for (var i = 0; i < parts.length; i++) {
      var tk = String(parts[i]).split(/\s+/);
      for (var j = 0; j < tk.length; j++) if (tk[j] && tk[j] !== '|') out.push(tk[j]);
    }
    return out;
  }

  function compact(str) { return String(str == null ? '' : str).replace(/\s+/g, ''); }

  /* =========================================================================
     2. НОТЫ, АККОРДЫ, ВОЛНЫ, ШУМ
     ========================================================================= */
  var NOTE_SEMI = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
  var FREQ_CACHE = {};

  function noteMidi(name) {
    var m = /^([A-Ga-g])([#b]?)(-?\d)$/.exec(String(name));
    if (!m) return NaN;
    var semi = NOTE_SEMI[m[1].toUpperCase()];
    if (m[2] === '#') semi += 1;
    else if (m[2] === 'b') semi -= 1;
    return (parseInt(m[3], 10) + 1) * 12 + semi;
  }
  function midiFreq(m) { return A4_HZ * Math.pow(2, (m - 69) / 12); }
  function noteFreq(name) {
    if (FREQ_CACHE[name]) return FREQ_CACHE[name];
    var m = noteMidi(name);
    if (!isFinite(m)) return 0;
    var f = midiFreq(m);
    FREQ_CACHE[name] = f;
    return f;
  }

  // Аккорды: [основа, терция, квинта, октава]. Нужны для арпеджио и баса.
  var CHORDS = {
    Am: ['A3', 'C4', 'E4', 'A4'],
    A:  ['A3', 'C#4', 'E4', 'A4'],
    F:  ['F3', 'A3', 'C4', 'F4'],
    C:  ['C4', 'E4', 'G4', 'C5'],
    G:  ['G3', 'B3', 'D4', 'G4'],
    Em: ['E3', 'G3', 'B3', 'E4'],
    E:  ['E3', 'G#3', 'B3', 'E4'],
    Dm: ['D3', 'F3', 'A3', 'D4'],
    D:  ['D4', 'F#4', 'A4', 'D5'],
    B:  ['B3', 'D#4', 'F#4', 'B4'],
    Bb: ['Bb3', 'D4', 'F4', 'Bb4'],
    Eb: ['Eb3', 'G3', 'Bb3', 'Eb4'],
    Gm: ['G3', 'Bb3', 'D4', 'G4']
  };
  var CHORD_MIDI = {};
  (function () {
    for (var name in CHORDS) {
      var src = CHORDS[name], dst = [];
      for (var i = 0; i < src.length; i++) dst.push(noteMidi(src[i]));
      CHORD_MIDI[name] = dst;
    }
  })();

  // Прямоугольная волна заданной скважности через ряд Фурье (PeriodicWave).
  // Нормализация включена по умолчанию, поэтому амплитуда пика равна 1.
  function makePulseWave(duty) {
    try {
      if (!ctx || !ctx.createPeriodicWave) return null;
      var n = 32, real = new Float32Array(n + 1), imag = new Float32Array(n + 1);
      for (var i = 1; i <= n; i++) {
        real[i] = (2 / (i * Math.PI)) * Math.sin(2 * Math.PI * i * duty);
        imag[i] = (2 / (i * Math.PI)) * (1 - Math.cos(2 * Math.PI * i * duty));
      }
      return ctx.createPeriodicWave(real, imag);
    } catch (e) { return null; }
  }

  // Один общий буфер белого шума для барабанов и эффектов.
  function makeNoise() {
    try {
      var sr = ctx.sampleRate || 44100;
      var len = Math.floor(sr * 2);
      var buf = ctx.createBuffer(1, len, sr);
      var data = buf.getChannelData(0);
      for (var i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
      return buf;
    } catch (e) { return null; }
  }

  // Мягкая кривая ограничителя: tanh, пик <= 1.
  function softCurve() {
    var n = 2048, curve = new Float32Array(n), k = 1.6, norm = Math.tanh(k);
    for (var i = 0; i < n; i++) {
      var x = (i * 2) / (n - 1) - 1;
      curve[i] = Math.tanh(x * k) / norm;
    }
    return curve;
  }

  function setWave(osc, which) {
    try {
      if (which === 'w12') {
        if (pulse12) osc.setPeriodicWave(pulse12);
        else osc.type = 'square';
      } else if (pulse25) {
        osc.setPeriodicWave(pulse25);
      } else {
        osc.type = 'square';
      }
    } catch (e) { try { osc.type = 'square'; } catch (e2) {} }
  }

  /* =========================================================================
     3. КОМПИЛЯТОР ТРЕКОВ
     -------------------------------------------------------------------------
     Формат описания:
       bpm, loop, wave ('w12'|'w25'), echo, chords: [...аккорд на такт],
       lead:   'A4 . C5 E5 | ...'   (шаг = 16-я нота, '.' пауза, '-' продление)
       arp:    '0.1.2.1...'          (0..3 — ступень аккорда, '.' пауза)
       bass:   'R.RR...'             (R корень, 3/5/7, O +окт, L -окт, b -1, '.'/'-')
       bassNotes: 'A2 . . ...'       (альтернатива: явные ноты)
       drums:  { kick:'x...x...', snare:'....x...', hat:'..', tom:'', crash:'' }
       fills:  { 3: { snare:'...', tom:'...' } }  — замена каналов в такте
     byStep[step] = [{ch, f, d, v, inst, open}] — готовое расписание.
     ========================================================================= */
  function compileSong(name, def) {
    var chords = def.chords || [];
    var bars = chords.length;
    if (!bars) { warn(name + ': нет аккордов'); return null; }
    var total = bars * 16;
    var byStep = new Array(total);

    function add(step, ev) {
      if (step < 0 || step >= total) return;
      if (!byStep[step]) byStep[step] = [ev];
      else byStep[step].push(ev);
    }

    /* --- лид --- */
    if (def.lead) {
      var toks = flatten(def.lead);
      if (toks.length !== total) warn(name + ': лид ' + toks.length + '/' + total);
      var step = 0, last = null;
      for (var i = 0; i < toks.length && step < total; i++) {
        var tk = toks[i];
        if (tk === '.') { last = null; step++; }
        else if (tk === '-') { if (last) last.d++; step++; }
        else {
          var f = noteFreq(tk);
          if (!f) { warn(name + ': нота лида "' + tk + '"'); last = null; step++; }
          else { last = { ch: 'lead', f: f, d: 1, v: 1 }; add(step, last); step++; }
        }
      }
    }

    /* --- арпеджио/гармония --- */
    if (def.arp) {
      var ap = compact(def.arp);
      if (ap.length !== 16) warn(name + ': арп ' + ap.length + '/16');
      var shift = (def.arpOct == null) ? 12 : toNum(def.arpOct, 12);
      for (var b = 0; b < bars; b++) {
        var tones = CHORD_MIDI[chords[b]];
        if (!tones) { warn(name + ': аккорд "' + chords[b] + '"'); continue; }
        for (var k = 0; k < 16; k++) {
          var c = ap.charAt(k);
          if (c < '0' || c > '3') continue;
          var deg = c.charCodeAt(0) - 48;
          add(b * 16 + k, { ch: 'harm', f: midiFreq(tones[deg] + shift), d: 1, v: deg === 0 ? 1 : 0.7 });
        }
      }
    }

    /* --- бас --- */
    var BASS_OFF = { R: 0, b: -1, '3': 3, '5': 7, '7': 10, O: 12, L: -12 };
    if (def.bassNotes) {
      var bt = flatten(def.bassNotes);
      if (bt.length !== total) warn(name + ': бас-ноты ' + bt.length + '/' + total);
      var bs = 0, bl = null;
      for (var j = 0; j < bt.length && bs < total; j++) {
        var btk = bt[j];
        if (btk === '.') { bl = null; bs++; }
        else if (btk === '-') { if (bl) bl.d++; bs++; }
        else {
          var bf = noteFreq(btk);
          if (!bf) { warn(name + ': нота баса "' + btk + '"'); bl = null; bs++; }
          else { bl = { ch: 'bass', f: bf, d: 1, v: 0.9 }; add(bs, bl); bs++; }
        }
      }
    } else if (def.bass) {
      var bp = compact(def.bass);
      if (bp.length !== 16) warn(name + ': бас ' + bp.length + '/16');
      for (var b2 = 0; b2 < bars; b2++) {
        var cm = CHORD_MIDI[chords[b2]];
        if (!cm) continue;
        var rootM = cm[0] - 12;
        var lastB = null;
        for (var k2 = 0; k2 < 16; k2++) {
          var bc = bp.charAt(k2);
          if (bc === '.') { lastB = null; continue; }
          if (bc === '-') { if (lastB) lastB.d++; continue; }
          var off = BASS_OFF[bc];
          if (off == null) continue;
          lastB = { ch: 'bass', f: midiFreq(rootM + off), d: 1, v: 0.9 };
          add(b2 * 16 + k2, lastB);
        }
      }
    }

    /* --- барабаны --- */
    if (def.drums) {
      var insts = ['kick', 'snare', 'hat', 'tom', 'crash'];
      for (var b3 = 0; b3 < bars; b3++) {
        var fill = (def.fills && def.fills[b3]) || null;
        for (var ii = 0; ii < insts.length; ii++) {
          var inst = insts[ii];
          var pat = compact((fill && fill[inst]) || def.drums[inst]);
          if (!pat) continue;
          if (pat.length !== 16) warn(name + ': ' + inst + ' ' + pat.length + '/16');
          for (var k3 = 0; k3 < 16; k3++) {
            var dc = pat.charAt(k3);
            if (dc !== 'x' && dc !== 'X' && dc !== 'o') continue;
            add(b3 * 16 + k3, {
              ch: 'drum', inst: inst,
              v: dc === 'X' ? 1 : (dc === 'o' ? 0.85 : 0.72),
              open: dc === 'o'
            });
          }
        }
      }
    }

    var mix = {};
    for (var mk in MIX_DEFAULTS) mix[mk] = toNum(def.mix && def.mix[mk], MIX_DEFAULTS[mk]);
    var bpm = toNum(def.bpm, 120);

    return {
      name: name,
      bpm: bpm,
      loop: def.loop !== false,
      stepDur: 60 / bpm / 4,
      total: total,
      byStep: byStep,
      wave: def.wave === 'w12' ? 'w12' : 'w25',
      echo: toNum(def.echo, 0.12),
      echoFb: toNum(def.echoFb, 0.26),
      mix: mix,
      kit: def.kit || {}
    };
  }

  /* =========================================================================
     4. ПАРТИТУРА — 6 оригинальных треков
     ========================================================================= */
  var SONG_DEFS = {

    /* --- ТИТУЛ: A minor, 104 BPM, 12 тактов (~27.7 с), тёмный synthwave --- */
    title: {
      bpm: 104,
      loop: true,
      wave: 'w12',
      echo: 0.22,
      chords: ['Am', 'F', 'C', 'G', 'Am', 'F', 'Dm', 'E', 'Am', 'F', 'G', 'Am'],
      lead: [
        'A4 - E5 - | C5 - - A4 | E5 - - D5 | C5 - A4 -',
        'C5 - F5 - | A5 - - F5 | E5 - - C5 | A4 - - -',
        'G4 - C5 - | E5 - - C5 | G5 - - E5 | C5 - - -',
        'B4 - D5 - | G5 - - D5 | B4 - - G4 | D5 - - -',
        'E5 - A5 - | G5 - - E5 | D5 - - C5 | B4 - - -',
        'C6 - A5 - | F5 - - A5 | C6 - - A5 | F5 - - -',
        'D5 - F5 - | A5 - - F5 | E5 - - D5 | A4 - - -',
        'B4 - E5 - | G#5 - - E5 | B5 - - G#5 | E5 - - -',
        'A5 - E5 - | C6 - - A5 | G5 - - E5 | D5 - - B4',
        'F5 - C5 - | A5 - - F5 | C6 - - A5 | F5 - - -',
        'G5 - D5 - | B4 - - D5 | G5 - - B5 | D6 - - -',
        'A5 - - - | E5 - - - | A4 - - - | - - - -'
      ],
      arp: '0.1.2.1.0.1.2.3.',
      arpOct: 12,
      bass: 'R...R...R...O...',
      drums: {
        kick: 'x.......x.......',
        snare: '....x.......x...',
        hat: 'x.x.x.x.x.x.x.x.',
        tom: '................',
        crash: '................'
      },
      fills: {
        0: { crash: 'x...............' },
        3: { tom: '...........x.x.x' },
        7: { tom: '.............xxx' },
        11: { crash: 'x...............', tom: '..........xxxxxx' }
      },
      mix: { lead: 0.46, harm: 0.12, bass: 0.4, drums: 0.36 },
      kit: { kickGain: 0.42, kickF0: 125, kickF1: 42, snareGain: 0.2, hatGain: 0.08, hatHp: 6500 }
    },

    /* --- УРОВЕНЬ 1: A natural minor, 150 BPM, 16 тактов (~25.6 с) --- */
    stage1: {
      bpm: 150,
      loop: true,
      wave: 'w25',
      echo: 0.14,
      chords: ['Am', 'Am', 'F', 'G', 'Am', 'C', 'F', 'G', 'F', 'G', 'Am', 'Am', 'F', 'G', 'E', 'E'],
      lead: [
        'A4 . C5 E5 | D5 . C5 . | A4 . B4 C5 | B4 . G4 .',
        'A4 . C5 E5 | D5 . C5 . | E5 . D5 C5 | B4 - - .',
        'C5 . F5 . | E5 . D5 . | C5 . D5 E5 | F5 . E5 .',
        'D5 . G5 . | F5 . E5 . | D5 . B4 D5 | E5 - - .',
        'A4 . C5 E5 | D5 . C5 . | A4 . B4 C5 | D5 . E5 .',
        'F5 . E5 D5 | C5 . B4 . | A4 . C5 E5 | A5 - - .',
        'G5 . F5 E5 | D5 . E5 . | F5 . E5 D5 | C5 . B4 .',
        'A4 . C5 E5 | G4 . B4 D5 | E5 . D5 C5 | B4 . G4 .',
        'F5 . A5 . | G5 . F5 . | E5 . F5 G5 | A5 . G5 .',
        'D5 . G5 . | F5 . E5 . | D5 . E5 F5 | G5 - - .',
        'A5 . E5 . | C5 . E5 . | A5 . G5 E5 | D5 . C5 .',
        'B4 . C5 D5 | E5 . G5 . | A5 . G5 E5 | D5 . B4 .',
        'C6 . A5 . | F5 . A5 . | C6 . B5 A5 | G5 . F5 .',
        'D5 . G5 . | B4 . D5 . | G5 . F5 D5 | B4 . G4 .',
        'E5 . G#5 . | B5 . A5 G#5 | E5 . D5 . | B4 . G#4 .',
        'E5 . B4 . | G#4 . E4 . | B4 . D5 . | E5 - - .'
      ],
      arp: '0.1.2.3.2.1.2.1.',
      arpOct: 12,
      bass: 'R.RR.R.RR.RR.R.R',
      drums: {
        kick: 'x.....x.x.......',
        snare: '....x.......x...',
        hat: 'x.x.x.x.x.x.x.x.',
        tom: '................',
        crash: '................'
      },
      fills: {
        3: { snare: '....x...x.x.xxxx', tom: '.............xxx' },
        7: { snare: '....x...x.x.x.xx', tom: '...........x.xxx' },
        11: { snare: '....x...x.x.xxxx', tom: '..........xxxxxx' },
        15: { snare: '....x...x.x.xxxx', tom: '..........xxxxxx', crash: 'x...............' }
      },
      mix: { lead: 0.44, harm: 0.14, bass: 0.42, drums: 0.48 },
      kit: { kickGain: 0.6, snareGain: 0.3, hatGain: 0.12 }
    },

    /* --- УРОВЕНЬ 2: D Phrygian, 136 BPM, 12 тактов (~21.2 с) --- */
    stage2: {
      bpm: 136,
      loop: true,
      wave: 'w12',
      echo: 0.1,
      chords: ['Dm', 'Eb', 'Dm', 'A', 'Dm', 'Bb', 'Gm', 'A', 'Dm', 'Bb', 'Eb', 'A'],
      lead: [
        'D5 . D5 . | Eb5 . D5 . | C5 . A4 . | D5 - - .',
        'Eb5 . Eb5 . | F5 . Eb5 . | D5 . Bb4 . | Eb5 - - .',
        'D5 . F5 . | A5 . G5 . | F5 . E5 . | D5 - - .',
        'A5 . G5 . | E5 . C#5 . | B4 . A4 . | A4 - - .',
        'D5 . F5 . | A5 . F5 . | D5 . E5 . | Eb5 - - .',
        'F5 . Bb5 . | A5 . F5 . | D5 . F5 . | Bb4 - - .',
        'G5 . Bb5 . | D6 . Bb5 . | G5 . F5 . | D5 - - .',
        'A5 . G5 . | E5 . C#5 . | D5 . B4 . | A4 - - .',
        'A5 . Bb5 . | A5 . F5 . | E5 . D5 . | A4 - - .',
        'Bb5 . A5 . | F5 . D5 . | Bb4 . D5 . | F5 - - .',
        'Eb5 . F5 . | G5 . Eb5 . | Bb4 . Eb5 . | G5 - - .',
        'A5 . G5 . | E5 . C#5 . | D5 . E5 . | D5 - - .'
      ],
      arp: '0.1.2.1.0.2.3.2.',
      arpOct: 12,
      bass: 'R..R.R...R..R.5.',
      drums: {
        kick: 'x..x..x...x..x..',
        snare: '....x.......x...',
        hat: 'x.xxx.x.x.xxx.o.',
        tom: '................',
        crash: '................'
      },
      fills: {
        3: { snare: '....x..x..x.xxxx', tom: '...........x.xxx' },
        7: { snare: '....x..x..x.x.xx', tom: '...........x.xxx' },
        8: { crash: 'x...............' },
        11: { snare: '....x..x..x.xxxx', tom: '..........xxxxxx' }
      },
      mix: { lead: 0.44, harm: 0.14, bass: 0.42, drums: 0.46 },
      kit: { kickF0: 135, kickF1: 38, kickDur: 0.13, hatHp: 8800, hatGain: 0.1, snareF: 2200, snareGain: 0.28 }
    },

    /* --- БОСС: E minor, 168 BPM, 12 тактов (~17.1 с), хроматический натиск --- */
    boss: {
      bpm: 168,
      loop: true,
      wave: 'w25',
      echo: 0.12,
      chords: ['Em', 'Em', 'C', 'B', 'Em', 'Em', 'C', 'B', 'C', 'D', 'Em', 'B'],
      lead: [
        'E5 . E5 . | F5 . E5 . | D#5 . E5 . | B4 - - .',
        'E5 . E5 . | G5 . F5 . | E5 . D#5 . | B4 - - .',
        'C5 . C5 . | D5 . C5 . | B4 . C5 . | G4 - - .',
        'B4 . B4 . | D#5 . C#5 . | B4 . A4 . | F#4 - - .',
        'E5 . G5 . | B5 . G5 . | E5 . F5 . | E5 - - .',
        'E5 . G5 . | B5 . D6 . | B5 . G5 . | E5 - - .',
        'C5 . E5 . | G5 . E5 . | C5 . D5 . | B4 - - .',
        'B4 . D#5 . | F#5 . D#5 . | B4 . C#5 . | B4 - - .',
        'C5 . C#5 . | D5 . D#5 . | E5 . F5 . | F#5 - - .',
        'D5 . D#5 . | E5 . F5 . | F#5 . G5 . | G#5 - - .',
        'B5 . Bb5 . | A5 . G#5 . | G5 . F#5 . | F5 - - .',
        'E5 . D#5 . | B4 . F#4 . | B4 . D#5 . | B4 - - .'
      ],
      arp: '0121012101232121',
      arpOct: 12,
      bass: 'R.R.R.R.5.R.R.RO',
      drums: {
        kick: 'x...x...x.x.....',
        snare: '....x.......x...',
        hat: 'x.x.x.x.x.x.x.x.',
        tom: '................',
        crash: '................'
      },
      fills: {
        3: { snare: '....x...x.x.xxxx', tom: '.............xxx' },
        7: { snare: '....x...x.x.x.xx', tom: '...........x.xxx' },
        8: { crash: 'x...............' },
        11: { snare: '....x...x.x.xxxx', tom: '..........xxxxxx' }
      },
      mix: { lead: 0.46, harm: 0.13, bass: 0.44, drums: 0.55 },
      kit: { kickF0: 118, kickF1: 34, kickDur: 0.16, kickGain: 0.78, snareGain: 0.34, hatGain: 0.09 }
    },

    /* --- ПОБЕДА: C major, 140 BPM, 6 тактов (~10.3 с), одноразовый фанфар --- */
    victory: {
      bpm: 140,
      loop: false,
      wave: 'w25',
      echo: 0.18,
      chords: ['C', 'F', 'G', 'C', 'F', 'C'],
      lead: [
        'G4 . C5 . | E5 . G5 . | C6 - - - | G5 - - .',
        'A5 - - - | F5 - A5 - | C6 - - - | A5 - - .',
        'B5 - - - | G5 - B5 - | D6 - - - | B5 - - .',
        'C6 - - - | G5 - E5 - | C5 - - - | - - - -',
        'F5 . A5 . | C6 . A5 . | F5 . G5 . | A5 - - .',
        'G5 - - - | E5 - G5 - | C6 - - - | - - - -'
      ],
      arp: '0.1.2.3.2.1.2.3.',
      arpOct: 24,
      bass: 'R...R...R...O...',
      drums: {
        kick: 'x...x...x...x...',
        snare: '....x.......x...',
        hat: 'x.x.x.x.x.x.x.x.',
        tom: '................',
        crash: '................'
      },
      fills: {
        0: { crash: 'x...............' },
        2: { snare: '....x...x.x.xxxx', tom: '.............xxx' },
        5: { crash: 'x...............', snare: '....x...x.x.xxxx', tom: '..........xxxxxx' }
      },
      mix: { lead: 0.46, harm: 0.16, bass: 0.42, drums: 0.5 },
      kit: { kickGain: 0.55, snareGain: 0.3, hatGain: 0.1 }
    },

    /* --- GAME OVER: A minor, 100 BPM, 4 такта (~9.6 с), одноразовый --- */
    gameover: {
      bpm: 100,
      loop: false,
      wave: 'w12',
      echo: 0.16,
      chords: ['Am', 'F', 'Dm', 'Am'],
      lead: [
        'E5 - - - | D5 - C5 - | B4 - - - | A4 - - -',
        'C5 - - - | B4 - A4 - | G4 - - - | F4 - - -',
        'D5 - - - | C5 - Bb4 - | A4 - - - | G4 - - -',
        'A4 - - - | E4 - - - | A3 - - - | - - - -'
      ],
      arp: '0...1...2...1...',
      arpOct: 12,
      bass: 'R.......5.......',
      drums: {
        kick: 'x.......x.......',
        snare: '....x.......x...',
        hat: '................',
        tom: '................',
        crash: '................'
      },
      fills: {
        3: { tom: '............x.x.' }
      },
      mix: { lead: 0.46, harm: 0.12, bass: 0.4, drums: 0.36 },
      kit: { kickGain: 0.4, snareGain: 0.2 }
    }
  };

  var SONGS = {};
  (function () {
    for (var nm in SONG_DEFS) {
      try {
        var song = compileSong(nm, SONG_DEFS[nm]);
        if (song) SONGS[nm] = song;
      } catch (e) { warn(nm + ': ' + (e && e.message ? e.message : e)); }
    }
  })();

  /* =========================================================================
     5. ОБЩИЕ ХЕЛПЕРЫ СИНТЕЗА
     ========================================================================= */
  function makeEnv(t, attack, peak, dur) {
    var g = ctx.createGain(), p = g.gain;
    var atk = Math.max(0.002, toNum(attack, 0.004));
    p.setValueAtTime(0.0001, t);
    p.exponentialRampToValueAtTime(Math.max(0.0003, peak), t + atk);
    p.exponentialRampToValueAtTime(0.0001, t + Math.max(atk + 0.01, dur));
    return g;
  }

  function autoClean(nodes) {
    if (!nodes || !nodes.length) return;
    var src = nodes[0];
    try {
      src.onended = function () {
        for (var i = 0; i < nodes.length; i++) {
          try { nodes[i].disconnect(); } catch (e) {}
        }
      };
    } catch (e) {}
  }

  function panner(v) {
    if (!ctx.createStereoPanner) return null;
    try {
      var p = ctx.createStereoPanner();
      p.pan.value = clamp(v, -1, 1);
      return p;
    } catch (e) { return null; }
  }

  // Шумовой всплеск: source -> фильтр -> огибающая -> dest (опц. панорама).
  function noiseBurst(t, dur, peak, type, f0, f1, q, dest, pan) {
    if (!noiseBuf || !dest) return null;
    try {
      var src = ctx.createBufferSource();
      src.buffer = noiseBuf;
      var flt = ctx.createBiquadFilter();
      flt.type = type || 'lowpass';
      flt.frequency.setValueAtTime(clamp(f0 || 8000, 40, 18000), t);
      if (f1 && f1 !== f0) flt.frequency.exponentialRampToValueAtTime(clamp(f1, 40, 18000), t + Math.max(0.01, dur));
      flt.Q.value = q || 0.9;
      var g = makeEnv(t, 0.002, peak, dur);
      var pn = (pan != null) ? panner(pan) : null;
      src.connect(flt);
      flt.connect(g);
      if (pn) { g.connect(pn); pn.connect(dest); } else g.connect(dest);
      var maxOff = Math.max(0, (noiseBuf.duration || 2) - dur - 0.06);
      try { src.start(t, Math.random() * maxOff); } catch (e) { try { src.start(t); } catch (e2) {} }
      try { src.stop(t + dur + 0.04); } catch (e) {}
      autoClean(pn ? [src, flt, g, pn] : [src, flt, g]);
      return g;
    } catch (e) { return null; }
  }

  /* =========================================================================
     6. ГОЛОСА МУЗЫКИ
     ========================================================================= */
  function playLead(tr, ev, t) {
    var dur = Math.max(0.03, ev.d * tr.stepDur * 0.94);
    var peak = 0.85 * (ev.v || 1);
    var o = ctx.createOscillator();
    setWave(o, tr.song.wave);
    o.frequency.setValueAtTime(ev.f, t);
    var g = ctx.createGain(), p = g.gain;
    var atk = Math.min(0.01, dur * 0.3);
    p.setValueAtTime(0.0001, t);
    p.linearRampToValueAtTime(peak, t + atk);
    if (dur > 0.14) p.linearRampToValueAtTime(peak * 0.78, t + dur * 0.7);
    p.linearRampToValueAtTime(0.0001, t + dur + 0.03);
    o.connect(g);
    g.connect(tr.bus.lead);
    o.start(t);
    o.stop(t + dur + 0.07);
    autoClean([o, g]);
  }

  function playHarm(tr, ev, t) {
    var dur = Math.max(0.04, ev.d * tr.stepDur * 0.55);
    var o = ctx.createOscillator();
    setWave(o, 'w12');
    o.frequency.setValueAtTime(ev.f, t);
    var g = ctx.createGain(), p = g.gain;
    var peak = 0.55 * (ev.v || 1);
    p.setValueAtTime(0.0001, t);
    p.linearRampToValueAtTime(peak, t + 0.004);
    p.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g);
    g.connect(tr.bus.harm);
    o.start(t);
    o.stop(t + dur + 0.03);
    autoClean([o, g]);
  }

  function playBass(tr, ev, t) {
    var dur = Math.max(0.05, ev.d * tr.stepDur * 0.88);
    var peak = 0.9 * (ev.v || 1);
    var o = ctx.createOscillator();
    o.type = 'triangle';
    o.frequency.setValueAtTime(ev.f, t);
    var g = ctx.createGain(), p = g.gain;
    p.setValueAtTime(0.0001, t);
    p.linearRampToValueAtTime(peak, t + 0.008);
    p.linearRampToValueAtTime(peak * 0.85, t + dur);
    p.linearRampToValueAtTime(0.0001, t + dur + 0.02);
    o.connect(g);
    g.connect(tr.bus.bass);
    o.start(t);
    o.stop(t + dur + 0.05);
    autoClean([o, g]);
  }

  function kitNum(kit, key, def) { return toNum(kit && kit[key], def); }

  function drumKick(t, kit, vel, dest) {
    var dur = kitNum(kit, 'kickDur', 0.12);
    var f0 = kitNum(kit, 'kickF0', 145), f1 = kitNum(kit, 'kickF1', 44);
    var gain = kitNum(kit, 'kickGain', 0.6) * vel;
    var o = ctx.createOscillator();
    o.type = 'triangle';
    o.frequency.setValueAtTime(f0, t);
    o.frequency.exponentialRampToValueAtTime(Math.max(25, f1), t + dur);
    var g = makeEnv(t, 0.002, gain, dur);
    o.connect(g);
    g.connect(dest);
    o.start(t);
    o.stop(t + dur + 0.04);
    autoClean([o, g]);
    noiseBurst(t, 0.02, 0.09 * vel, 'highpass', 1500, 3200, 0.7, dest);
  }

  function drumSnare(t, kit, vel, dest) {
    var gain = kitNum(kit, 'snareGain', 0.3) * vel;
    var f = kitNum(kit, 'snareF', 1900);
    noiseBurst(t, kitNum(kit, 'snareDur', 0.1), gain, 'bandpass', f, f * 0.6, 1.1, dest);
    var o = ctx.createOscillator();
    o.type = 'triangle';
    o.frequency.setValueAtTime(210, t);
    o.frequency.exponentialRampToValueAtTime(140, t + 0.08);
    var g = makeEnv(t, 0.002, gain * 0.6, 0.08);
    o.connect(g);
    g.connect(dest);
    o.start(t);
    o.stop(t + 0.11);
    autoClean([o, g]);
  }

  function drumHat(t, kit, vel, open, dest) {
    var dur = open ? kitNum(kit, 'openDur', 0.12) : kitNum(kit, 'hatDur', 0.035);
    var gain = kitNum(kit, 'hatGain', 0.13) * vel * (open ? 0.8 : 1);
    noiseBurst(t, dur, gain, 'highpass', kitNum(kit, 'hatHp', 7500), null, 0.8, dest);
  }

  function drumTom(t, kit, vel, dest) {
    var dur = kitNum(kit, 'tomDur', 0.16);
    var f0 = kitNum(kit, 'tomF0', 210), f1 = kitNum(kit, 'tomF1', 105);
    var o = ctx.createOscillator();
    o.type = 'triangle';
    o.frequency.setValueAtTime(f0, t);
    o.frequency.exponentialRampToValueAtTime(f1, t + dur);
    var g = makeEnv(t, 0.002, kitNum(kit, 'tomGain', 0.4) * vel, dur);
    o.connect(g);
    g.connect(dest);
    o.start(t);
    o.stop(t + dur + 0.03);
    autoClean([o, g]);
    noiseBurst(t, 0.03, 0.07 * vel, 'bandpass', 900, 500, 0.8, dest);
  }

  function drumCrash(t, kit, vel, dest) {
    noiseBurst(t, kitNum(kit, 'crashDur', 0.55), kitNum(kit, 'crashGain', 0.18) * vel,
      'highpass', kitNum(kit, 'crashHp', 3200), null, 0.6, dest);
  }

  function playDrum(tr, ev, t) {
    var kit = tr.song.kit;
    switch (ev.inst) {
      case 'kick': drumKick(t, kit, ev.v, tr.bus.drums); break;
      case 'snare': drumSnare(t, kit, ev.v, tr.bus.drums); break;
      case 'hat': drumHat(t, kit, ev.v, ev.open, tr.bus.drums); break;
      case 'tom': drumTom(t, kit, ev.v, tr.bus.drums); break;
      case 'crash': drumCrash(t, kit, ev.v, tr.bus.drums); break;
    }
  }

  function scheduleStep(tr, step, when) {
    var list = tr.song.byStep[step];
    if (!list || !list.length) return;
    var now = ctx.currentTime;
    for (var i = 0; i < list.length; i++) {
      var ev = list[i];
      var t = when > now ? when : now;
      if (ev.ch === 'lead') playLead(tr, ev, t);
      else if (ev.ch === 'harm') playHarm(tr, ev, t);
      else if (ev.ch === 'bass') playBass(tr, ev, t);
      else if (ev.ch === 'drum') playDrum(tr, ev, t);
    }
  }

  /* =========================================================================
     7. SFX — короткие синтезированные эффекты
     ========================================================================= */
  function sfxOsc(t, type, f0, f1, dur, peak, opts) {
    opts = opts || {};
    var o = ctx.createOscillator();
    if (opts.wave) setWave(o, opts.wave);
    else o.type = type || 'square';
    var f = clamp(toNum(f0, 440), 20, 18000);
    o.frequency.setValueAtTime(f, t);
    var fEnd = clamp(toNum(f1, f), 20, 18000);
    if (fEnd !== f) o.frequency.exponentialRampToValueAtTime(fEnd, t + Math.max(0.01, dur));
    var g = makeEnv(t, opts.atk || 0.003, peak, dur);
    var pn = (opts.pan != null) ? panner(opts.pan) : null;
    o.connect(g);
    if (pn) { g.connect(pn); pn.connect(sfxBus); } else g.connect(sfxBus);
    o.start(t);
    o.stop(t + dur + 0.04);
    autoClean(pn ? [o, g, pn] : [o, g]);
  }

  function sfxNotes(t, freqs, gap, dur, peak, wave) {
    for (var i = 0; i < freqs.length; i++) {
      var last = i === freqs.length - 1;
      sfxOsc(t + i * gap, 'triangle', freqs[i], freqs[i], last ? dur * 1.8 : dur,
        last ? peak : peak * 0.9, { wave: wave });
    }
  }

  var SFX = {
    shot: function (t) {
      var r = rnd(0.94, 1.06);
      sfxOsc(t, 0, 900 * r, 430 * r, 0.06, 0.2, { wave: 'w12' });
    },
    shot_spread: function (t) {
      var r = rnd(0.93, 1.06);
      sfxOsc(t, 0, 480 * r, 150 * r, 0.13, 0.13, { wave: 'w25', pan: rnd(-0.2, 0.2) });
      noiseBurst(t, 0.13, 0.16, 'bandpass', 1600, 420, 0.9, sfxBus, rnd(-0.3, 0.3));
    },
    shot_laser: function (t) {
      var r = rnd(0.95, 1.05);
      sfxOsc(t, 0, 1900 * r, 210 * r, 0.17, 0.15, { wave: 'w12' });
      noiseBurst(t, 0.15, 0.06, 'highpass', 3200, 900, 0.8, sfxBus);
    },
    shot_machine: function (t) {
      var r = rnd(0.92, 1.08);
      sfxOsc(t, 0, 1100 * r, 680 * r, 0.035, 0.14, { wave: 'w12' });
    },
    jump: function (t) {
      sfxOsc(t, 'triangle', 300 * rnd(0.96, 1.04), 760, 0.12, 0.16);
      sfxOsc(t, 0, 600, 1200, 0.09, 0.05, { wave: 'w12' });
    },
    land: function (t) {
      noiseBurst(t, 0.1, 0.16, 'lowpass', 600, 150, 0.9, sfxBus);
      sfxOsc(t, 'triangle', 165, 70, 0.11, 0.16);
    },
    hit: function (t) {
      var r = rnd(0.92, 1.08);
      sfxOsc(t, 0, 1350 * r, 760 * r, 0.05, 0.13, { wave: 'w25' });
      noiseBurst(t, 0.04, 0.08, 'highpass', 2400, 4000, 0.7, sfxBus);
    },
    explode: function (t) {
      noiseBurst(t, 0.4, 0.32, 'lowpass', 2500, 140, 0.8, sfxBus, rnd(-0.15, 0.15));
      sfxOsc(t, 'triangle', 120, 36, 0.36, 0.28);
      noiseBurst(t, 0.3, 0.12, 'bandpass', 650, 300, 0.8, sfxBus);
    },
    powerup: function (t) {
      sfxNotes(t, [523.25, 659.25, 783.99, 1046.5], 0.05, 0.09, 0.12, 'w25');
    },
    weapon: function (t) {
      sfxOsc(t, 0, 880, 1320, 0.07, 0.14, { wave: 'w12' });
      sfxOsc(t + 0.07, 0, 1320, 1760, 0.1, 0.12, { wave: 'w25' });
      noiseBurst(t + 0.07, 0.08, 0.05, 'highpass', 4000, 7000, 0.8, sfxBus);
    },
    death: function (t) {
      sfxOsc(t, 'sawtooth', 620, 58, 0.4, 0.16, { pan: -0.1 });
      sfxOsc(t + 0.02, 0, 310, 40, 0.38, 0.08, { wave: 'w12' });
      noiseBurst(t, 0.4, 0.12, 'lowpass', 1600, 90, 0.8, sfxBus);
    },
    checkpoint: function (t) {
      sfxOsc(t, 'triangle', 1046.5, 1046.5, 0.22, 0.11);
      sfxOsc(t + 0.1, 'triangle', 1568, 1568, 0.28, 0.09);
    },
    select: function (t) {
      sfxOsc(t, 0, 1180, 1500, 0.035, 0.11, { wave: 'w25' });
    },
    start: function (t) {
      sfxNotes(t, [440, 554.37, 659.25, 880], 0.055, 0.06, 0.13, 'w25');
      noiseBurst(t, 0.25, 0.06, 'highpass', 800, 5000, 0.8, sfxBus);
    },
    boss_hit: function (t) {
      var r = rnd(0.96, 1.04);
      sfxOsc(t, 0, 330 * r, 250 * r, 0.09, 0.14, { wave: 'w25' });
      sfxOsc(t, 0, 466 * r, 395 * r, 0.08, 0.09, { wave: 'w12' });
      noiseBurst(t, 0.07, 0.09, 'highpass', 2600, 5200, 1.2, sfxBus);
    },
    alarm: function (t) {
      var o = ctx.createOscillator();
      o.type = 'square';
      o.frequency.setValueAtTime(780, t);
      o.frequency.setValueAtTime(590, t + 0.15);
      o.frequency.setValueAtTime(780, t + 0.3);
      o.frequency.setValueAtTime(590, t + 0.45);
      var g = ctx.createGain(), p = g.gain;
      p.setValueAtTime(0.0001, t);
      p.linearRampToValueAtTime(0.11, t + 0.012);
      p.setValueAtTime(0.11, t + 0.5);
      p.exponentialRampToValueAtTime(0.0001, t + 0.62);
      o.connect(g);
      g.connect(sfxBus);
      o.start(t);
      o.stop(t + 0.65);
      autoClean([o, g]);
    }
  };

  // Глубина/длительность дакинга музыки для особенно громких эффектов.
  var DUCK_SFX = {
    explode: [0.35, 0.16],
    death: [0.3, 0.2],
    alarm: [0.22, 0.28]
  };

  function sfx(name) {
    try {
      if (!ctx || muted || ctx.state !== 'running') return;
      var fn = SFX[name];
      if (!fn) return;
      fn(ctx.currentTime + 0.004);
      // Крупные взрывы/сирена слегка присаживают музыку, чтобы эффект не тонул.
      var duck = DUCK_SFX[name];
      if (duck) duckMusic(duck[0], duck[1]);
    } catch (e) {}
  }

  // Короткий побочный дакинг шины музыки (side-chain по громким SFX).
  function duckMusic(depth, hold) {
    if (!ctx || !musicBus) return;
    try {
      var p = musicBus.gain, now = ctx.currentTime;
      var cur = (typeof p.value === 'number' && isFinite(p.value)) ? p.value : MUSIC_VOL;
      var low = MUSIC_VOL * (1 - clamp(depth, 0, 0.7));
      p.cancelScheduledValues(now);
      p.setValueAtTime(cur, now);
      p.linearRampToValueAtTime(low, now + 0.02);
      p.setValueAtTime(low, now + hold);
      p.linearRampToValueAtTime(MUSIC_VOL, now + hold + 0.13);
    } catch (e) {}
  }

  /* =========================================================================
     8. ШИНЫ, КОНТЕКСТ, ТРЕКИ, ПЛАНИРОВЩИК
     ========================================================================= */
  function buildContext() {
    if (ctx) return true;
    if (!AC) return false;
    try { ctx = new AC(); } catch (e) { ctx = null; return false; }
    try {
      comp = ctx.createDynamicsCompressor();
      comp.threshold.value = -14;
      comp.knee.value = 10;
      comp.ratio.value = 8;
      comp.attack.value = 0.004;
      comp.release.value = 0.22;

      limiter = ctx.createWaveShaper();
      limiter.curve = softCurve();
      limiter.oversample = '2x';

      master = ctx.createGain();
      master.gain.value = muted ? 0 : userVol;

      master.connect(comp);
      comp.connect(limiter);
      limiter.connect(ctx.destination);

      musicBus = ctx.createGain();
      musicBus.gain.value = MUSIC_VOL;
      musicBus.connect(master);

      sfxBus = ctx.createGain();
      sfxBus.gain.value = SFX_VOL;
      sfxBus.connect(master);

      pulse12 = makePulseWave(0.125);
      pulse25 = makePulseWave(0.25);
      noiseBuf = makeNoise();

      if (ctx.addEventListener) ctx.addEventListener('statechange', onState);
      else ctx.onstatechange = onState;
      ensureVisibilityHook();
      hidden = doc ? !!doc.hidden : false;
      return true;
    } catch (e) {
      try { if (ctx && ctx.close) ctx.close(); } catch (e2) {}
      ctx = null;
      master = comp = limiter = musicBus = sfxBus = null;
      return false;
    }
  }

  function applyMasterVolume(ramp) {
    if (!ctx || !master) return;
    try {
      var p = master.gain;
      var target = muted ? 0 : userVol;
      var now = ctx.currentTime;
      var cur = (typeof p.value === 'number' && isFinite(p.value)) ? p.value : target;
      p.cancelScheduledValues(now);
      p.setValueAtTime(cur, now);
      p.linearRampToValueAtTime(target, now + Math.max(0.02, toNum(ramp, 0.05)));
    } catch (e) {}
  }

  function isPlaying(name) {
    for (var i = 0; i < active.length; i++) {
      if (active[i].name === name && !active[i].stopping) return true;
    }
    return false;
  }

  function disposeTrack(tr) {
    if (!tr) return;
    var nodes = tr.nodes || [];
    for (var i = 0; i < nodes.length; i++) {
      try { nodes[i].disconnect(); } catch (e) {}
    }
    tr.nodes = [];
  }

  function beginStop(tr, fade) {
    if (!tr || tr.stopping || !ctx) return;
    tr.stopping = true;
    var now = ctx.currentTime;
    var dur = clamp(toNum(fade, 0.25), 0.02, 3);
    try {
      var p = tr.gain.gain;
      var cur = (typeof p.value === 'number' && isFinite(p.value)) ? p.value : 1;
      p.cancelScheduledValues(now);
      p.setValueAtTime(Math.max(0.0001, cur), now);
      p.linearRampToValueAtTime(0.0001, now + dur);
    } catch (e) {}
    tr.stopAt = now + dur + 0.08;
  }

  function fadeOutAll(fade) {
    for (var i = 0; i < active.length; i++) {
      if (!active[i].stopping) beginStop(active[i], fade);
    }
  }

  function ensureScheduler() {
    if (schedTimer != null || !timers || !ctx) return;
    schedTimer = timers.set(tick, TICK_MS);
  }

  function stopScheduler() {
    if (schedTimer != null && timers) timers.clear(schedTimer);
    schedTimer = null;
  }

  function tick() {
    try {
      if (!ctx || !active.length) { stopScheduler(); return; }
      if (ctx.state !== 'running') return;
      var now = ctx.currentTime;
      for (var i = active.length - 1; i >= 0; i--) {
        var tr = active[i];
        if (tr.stopping) {
          if (now >= tr.stopAt) { disposeTrack(tr); active.splice(i, 1); }
          continue;
        }
        // Защита от "залпа" после долгой паузы/засыпания таба.
        if (tr.nextTime < now - 0.2) tr.nextTime = now + 0.03;
        var guard = 0;
        while (tr.nextTime < now + LOOKAHEAD && guard++ < 48) {
          scheduleStep(tr, tr.step, tr.nextTime);
          tr.nextTime += tr.stepDur;
          tr.step++;
          if (tr.step >= tr.song.total) {
            tr.step = 0;
            if (!tr.song.loop) {
              if (desired === tr.name) desired = null;
              beginStop(tr, 1.15);
              break;
            }
          }
        }
      }
      if (!active.length) stopScheduler();
    } catch (e) { /* интервал не должен умирать из-за одной ошибки */ }
  }

  function createTrack(name, startStep, fadeIn) {
    var song = SONGS[name];
    if (!song || !ctx) return null;
    var now = ctx.currentTime;
    var g = ctx.createGain();
    var nodes = [g];
    try {
      g.gain.setValueAtTime(0.0001, now);
      g.gain.linearRampToValueAtTime(1, now + Math.max(0.03, toNum(fadeIn, 0.18)));
    } catch (e) { try { g.gain.value = 1; } catch (e2) {} }
    g.connect(musicBus);

    function bus(level) {
      var b = ctx.createGain();
      b.gain.value = Math.max(0.0001, toNum(level, 0.2));
      b.connect(g);
      nodes.push(b);
      return b;
    }
    var buses = {
      lead: bus(song.mix.lead),
      harm: bus(song.mix.harm),
      bass: bus(song.mix.bass),
      drums: bus(song.mix.drums)
    };

    // Короткое эхо для «неонового» лоска (только лид).
    if (song.echo > 0.01) {
      try {
        var send = ctx.createGain();
        send.gain.value = clamp(song.echo, 0, 0.4);
        var dly = ctx.createDelay(1.0);
        dly.delayTime.value = clamp(song.stepDur * 3, 0.09, 0.85);
        var fb = ctx.createGain();
        fb.gain.value = clamp(song.echoFb, 0, 0.55);
        var lp = ctx.createBiquadFilter();
        lp.type = 'lowpass';
        lp.frequency.value = 2600;
        buses.lead.connect(send);
        send.connect(dly);
        dly.connect(fb);
        fb.connect(dly);
        dly.connect(lp);
        lp.connect(g);
        nodes.push(send, dly, fb, lp);
      } catch (e) {}
    }

    var tr = {
      name: name,
      song: song,
      gain: g,
      nodes: nodes,
      bus: buses,
      step: (startStep || 0) % song.total,
      stepDur: song.stepDur,
      nextTime: now + 0.06,
      stopping: false,
      stopAt: 0
    };
    active.push(tr);
    ensureScheduler();
    tick();
    return tr;
  }

  function maybeStart() {
    try {
      if (!ctx || muted || ctx.state !== 'running') return;
      var nm = desired;
      if (!nm || !SONGS[nm] || isPlaying(nm)) return;
      var step = 0;
      if (resumePos && resumePos.name === nm) { step = resumePos.step; resumePos = null; }
      fadeOutAll(0.2);
      createTrack(nm, step, 0.18);
    } catch (e) {}
  }

  /* =========================================================================
     9. ВИДИМОСТЬ ВКЛАДКИ, ЖЕСТЫ, UNLOCK
     ========================================================================= */
  function ensureVisibilityHook() {
    if (visibilityHook || !doc || !doc.addEventListener) return;
    visibilityHook = true;
    try { doc.addEventListener('visibilitychange', onVisibility); } catch (e) {}
  }

  function onVisibility() {
    try {
      hidden = doc ? !!doc.hidden : false;
      if (!ctx) return;
      if (hidden) {
        // Браузер может усыпить контекст сам; мы останавливаем планировщик,
        // чтобы после возврата не выстрелить пачкой нот.
        stopScheduler();
        if (ctx.state === 'running' && ctx.suspend) {
          var p = ctx.suspend();
          if (p && p.catch) p.catch(function () {});
        }
      } else {
        if (ctx.state === 'suspended' && ctx.resume) {
          var q = ctx.resume();
          if (q && q.catch) q.catch(function () {});
        }
        for (var i = 0; i < active.length; i++) {
          if (!active[i].stopping) active[i].nextTime = ctx.currentTime + 0.08;
        }
        applyMasterVolume(0.05);
        ensureScheduler();
        maybeStart();
      }
    } catch (e) {}
  }

  function onState() {
    try {
      if (!ctx) return;
      if (ctx.state === 'running') {
        applyMasterVolume(0.05);
        maybeStart();
        ensureScheduler();
      }
    } catch (e) {}
  }

  function onGesture() {
    try { unlock(); } catch (e) {}
    if (isReady()) removeGestureHooks();
  }

  function removeGestureHooks() {
    if (!gestureHooks) return;
    gestureHooks = false;
    try {
      if (!root.removeEventListener) return;
      var opts = { passive: true };
      root.removeEventListener('pointerdown', onGesture, opts);
      root.removeEventListener('keydown', onGesture, false);
      root.removeEventListener('touchstart', onGesture, opts);
    } catch (e) {}
  }

  function ensureGestureHooks() {
    ensureVisibilityHook();
    if (gestureHooks || !root.addEventListener) return;
    gestureHooks = true;
    try {
      root.addEventListener('pointerdown', onGesture, { passive: true });
      root.addEventListener('keydown', onGesture, false);
      root.addEventListener('touchstart', onGesture, { passive: true });
    } catch (e) {}
  }

  function unlock() {
    try {
      ensureGestureHooks();
      if (!AC) return false;
      if (!ctx && !buildContext()) return false;
      var resuming = null;
      if (ctx.state !== 'running') {
        try { resuming = ctx.resume(); } catch (e) {}
      }
      var ready = function () {
        try {
          applyMasterVolume(0.05);
          maybeStart();
          ensureScheduler();
        } catch (e) {}
      };
      if (resuming && typeof resuming.then === 'function') resuming.then(ready, function () {});
      if (ctx.state === 'running') ready();
      return isReady() || !!resuming;
    } catch (e) { return false; }
  }

  function isReady() {
    try { return !!(ctx && ctx.state === 'running'); } catch (e) { return false; }
  }

  /* =========================================================================
     10. ПУБЛИЧНЫЙ API
     ========================================================================= */
  function startMusic(name) {
    try {
      ensureGestureHooks();
      if (typeof name !== 'string' || !SONGS[name]) return;
      desired = name;
      if (resumePos && resumePos.name !== name) resumePos = null;
      if (!ctx) return;                       // запомнили, стартуем после unlock
      if (muted) { fadeOutAll(0.15); return; } // не звучим, но трек запомнен
      if (ctx.state !== 'running') return;     // дождёмся resume/statechange
      if (isPlaying(name)) return;             // идемпотентность
      resumePos = null;
      fadeOutAll(0.22);
      createTrack(name, 0, 0.22);
    } catch (e) {}
  }

  function stopMusic(fadeSec) {
    try {
      desired = null;
      resumePos = null;
      if (!ctx) { active.length = 0; stopScheduler(); return; }
      if (!active.length) { stopScheduler(); return; }
      var fade = clamp(toNum(fadeSec, 0.25), 0.02, 3);
      fadeOutAll(fade);
    } catch (e) {}
  }

  function setMuted(v) {
    try {
      var m = !!v;
      if (m === muted) return muted;
      muted = m;
      applyMasterVolume(0.05);
      if (!ctx) return muted;
      if (muted) {
        var live = null;
        for (var i = 0; i < active.length; i++) if (!active[i].stopping) live = active[i];
        resumePos = (desired && live && live.name === desired)
          ? { name: desired, step: live.step } : null;
        // Не рвём граф мгновенно (щелчок): master уже едет в 0, узлы
        // освобождаем через короткую паузу.
        var old = active.slice(0);
        active.length = 0;
        stopScheduler();
        var release = function () {
          for (var k = 0; k < old.length; k++) disposeTrack(old[k]);
        };
        if (root.setTimeout) {
          try { root.setTimeout(release, 120); } catch (e) { release(); }
        } else {
          release();
        }
      } else if (ctx.state === 'running') {
        maybeStart();
      }
      return muted;
    } catch (e) { return muted; }
  }

  function setVolume(v) {
    try {
      var n = +v;
      if (!isFinite(n)) return userVol;
      userVol = clamp(n, 0, 1);
      applyMasterVolume(0.03);
      return userVol;
    } catch (e) { return userVol; }
  }

  var api = {
    unlock: unlock,
    isReady: isReady,
    startMusic: startMusic,
    stopMusic: stopMusic,
    sfx: sfx,
    setMuted: setMuted,
    toggleMuted: function () {
      try { return setMuted(!muted); } catch (e) { return muted; }
    },
    getMuted: function () { return muted; },
    setVolume: setVolume,
    getVolume: function () { return userVol; }
  };

  try { root.CONTRA_AUDIO = api; } catch (e) {}
})();

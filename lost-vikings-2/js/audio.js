/* ============================================================================
   LOST VIKINGS 2 · NORSE BY NORSEWEST · audio.js
   LV.audio — оригинальный чиптюн и SFX на WebAudio. Все звуки синтезируются,
   внешних сэмплов и файлов нет.

   Состав трека: 2 пульсовых канала (duty 12.5% / 25% / 50%), треугольный бас,
   треугольные пэды/арпеджио и шумовые барабаны. Скандинавские лады.
   Планировщик: lookahead 25 мс, горизонт 0.1 с, бесшовный луп по тактам.

   API: unlock, isReady, playMusic, stopMusic, pauseMusic, resumeMusic, sfx,
        setMuted, toggleMuted, getMuted, setVolume (+ getVolume/getCurrentMusic).

   Модуль не трогает DOM при загрузке; все вызовы безопасны до unlock.
   ========================================================================== */
window.LV = window.LV || {};
(function () {
  'use strict';

  /* ==========================================================================
     1. МУЗЫКАЛЬНАЯ ТЕОРИЯ И ДАННЫЕ ТРЕКОВ
     ========================================================================== */

  var SEMI = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
  var NOTE_RE = /^([A-Ga-g])([#b]?)(-?\d+)$/;

  // "A4" -> 69, "C#5" -> 73, "Bb3" -> 58
  function midiOf(name) {
    var m = NOTE_RE.exec(name);
    if (!m) return null;
    var base = SEMI[m[1].toUpperCase()];
    var acc = m[2] === '#' ? 1 : (m[2] === 'b' ? -1 : 0);
    var oct = parseInt(m[3], 10);
    return (oct + 1) * 12 + base + acc;
  }

  function freqOf(midi) {
    return 440 * Math.pow(2, (midi - 69) / 12);
  }

  // Интервалы аккордов от основы.
  var QUALITY = {
    m: [0, 3, 7, 12],
    M: [0, 4, 7, 12],
    m7: [0, 3, 7, 10],
    M7: [0, 4, 7, 11]
  };

  function chord(rootMidi, q) {
    return { r: rootMidi, i: QUALITY[q] || QUALITY.M };
  }

  // Канал: wave 'pulse'|'triangle', duty, vol, gate, attack/decay/sustain/release,
  // vib {rate,depth} — вибрато для длинных нот; для арпеджио — pattern/step/oct.
  function leadCh(over) {
    var c = {
      wave: 'pulse', duty: 0.5, vol: 0.13, gate: 0.88,
      attack: 0.004, decay: 0.05, sustain: 0.75, release: 0.03
    };
    return merge(c, over);
  }
  function triangleCh(over) {
    var c = {
      wave: 'triangle', vol: 0.09, gate: 0.95,
      attack: 0.008, decay: 0.08, sustain: 0.7, release: 0.08
    };
    return merge(c, over);
  }
  function merge(a, b) {
    var out = {};
    var k;
    for (k in a) if (Object.prototype.hasOwnProperty.call(a, k)) out[k] = a[k];
    if (b) for (k in b) if (Object.prototype.hasOwnProperty.call(b, k)) out[k] = b[k];
    return out;
  }

  // ---- Треки ---------------------------------------------------------------
  // prog — аккорды по тактам; lead — потактовые ноты (каждый такт = 16 шагов,
  // токен "нота:длительность", '|' — граница такта); bass — фигура в долях
  // тонов аккорда (R/T/F/O/L, r — пауза); arp генерируется из аккорда.
  // Оригинальные мелодии, не из игр.
  var TRACKS = {

    /* --- title: полярная ночь, 90 BPM, A-moll/dorian, 8 тактов ---------- */
    title: {
      id: 'title', bpm: 90, bars: 8, trim: 1,
      chords: {
        Am7: chord(57, 'm7'),
        Em7: chord(52, 'm7'),
        Fmaj7: chord(53, 'M7'),
        G: chord(55, 'M'),
        Dm7: chord(50, 'm7')
      },
      prog: ['Am7', 'Em7', 'Fmaj7', 'G', 'Am7', 'Em7', 'Dm7', 'Am7'],
      lead:
        'A4:6 C5:2 E5:4 D5:4 | E5:6 D5:2 B4:8 | ' +
        'A4:4 C5:4 E5:4 F5:4 | G5:6 F5:2 D5:4 B4:4 | ' +
        'C5:6 E5:2 A5:8 | G5:6 F5:2 E5:8 | ' +
        'D5:4 F5:4 A5:4 G5:4 | E5:8 C5:4 A4:4',
      leadCh: leadCh({
        duty: 0.25, vol: 0.105, gate: 0.92, attack: 0.012,
        decay: 0.12, sustain: 0.82, release: 0.07,
        vib: { rate: 4.6, depth: 6 }
      }),
      arp: {
        wave: 'triangle', vol: 0.048, gate: 1.0, attack: 0.01,
        decay: 0.2, sustain: 0.55, release: 0.4,
        pattern: [0, 2, 1, 3], step: 4, oct: 12
      },
      bassCh: triangleCh({ vol: 0.17, gate: 0.98, attack: 0.01, release: 0.12 }),
      bass: 'R:6 R:6 F:4',
      bassOct: -12,
      pad: {
        wave: 'triangle', vol: 0.034, gate: 1.0, attack: 0.3,
        decay: 0.2, sustain: 0.9, release: 0.55, tones: [1, 2], span: 8
      },
      drums: {
        mul: 0.5,
        kick: ['x...............', '................', 'x...............', '................'],
        hat: ['........x.......', '................', '........x.......', '................'],
        crash: ['x...............', '................', '................', '................']
      },
      wind: { vol: 0.05, freq: 850, q: 0.8, lfo: 0.06, depth: 0.6 }
    },

    /* --- game0: драккар-бит, 132 BPM, A-moll, 16 тактов ---------------- */
    game0: {
      id: 'game0', bpm: 132, bars: 16, trim: 0.9,
      chords: {
        Am: chord(57, 'm'), F: chord(53, 'M'), C: chord(48, 'M'),
        G: chord(55, 'M'), E: chord(52, 'M')
      },
      prog: [
        'Am', 'F', 'C', 'G', 'Am', 'F', 'G', 'Am',
        'Am', 'F', 'C', 'G', 'F', 'G', 'Am', 'E'
      ],
      lead:
        'E5:2 A5:2 G5:2 E5:2 D5:2 C5:2 D5:4 | ' +
        'C5:2 F5:2 E5:2 C5:2 A4:2 C5:2 D5:2 E5:2 | ' +
        'G4:2 C5:2 E5:2 G5:2 E5:2 C5:2 D5:4 | ' +
        'D5:2 B4:2 G4:2 B4:2 D5:2 E5:2 F5:2 G5:2 | ' +
        'A5:2 E5:2 A5:2 C6:2 B5:2 A5:2 G5:2 E5:2 | ' +
        'F5:2 C5:2 F5:2 A5:2 G5:2 F5:2 E5:2 C5:2 | ' +
        'D5:2 G5:2 F5:2 D5:2 B4:2 D5:2 E5:2 F5:2 | ' +
        'E5:2 D5:2 C5:2 B4:2 A4:4 C5:2 E5:2 | ' +
        'E5:2 A5:2 G5:2 E5:2 D5:2 C5:2 D5:4 | ' +
        'C5:2 F5:2 E5:2 C5:2 A4:2 C5:2 D5:2 E5:2 | ' +
        'G4:2 C5:2 E5:2 G5:2 E5:2 C5:2 D5:4 | ' +
        'D5:2 B4:2 G4:2 B4:2 D5:2 E5:2 F5:2 G5:2 | ' +
        'A5:2 F5:2 C6:2 A5:2 F5:2 A5:2 C6:2 D6:2 | ' +
        'B5:2 G5:2 D6:2 B5:2 G5:2 B5:2 D6:2 E6:2 | ' +
        'C6:2 B5:2 A5:2 E5:2 A5:2 C6:2 B5:2 A5:2 | ' +
        'G#5:2 B5:2 E6:2 D6:2 B5:2 G#5:2 E5:2 r:2',
      leadCh: leadCh({
        duty: 0.5, vol: 0.125, gate: 0.84, attack: 0.004,
        decay: 0.05, sustain: 0.72, release: 0.025
      }),
      arp: {
        wave: 'pulse', duty: 0.125, vol: 0.038, gate: 0.55,
        attack: 0.003, decay: 0.03, sustain: 0.5, release: 0.02,
        pattern: [0, 1, 2, 3, 1, 2, 3, 2], step: 2, oct: 12
      },
      bassCh: triangleCh({ vol: 0.19, gate: 0.86, attack: 0.005, release: 0.04 }),
      bass: 'R:2 R:2 O:2 R:2 R:2 F:2 O:2 R:2',
      bassOct: -12,
      drums: {
        mul: 1,
        kick: [
          'x..x..x.x..x..x.', 'x..x..x.x..x..x.',
          'x..x..x.x..x..x.', 'x..x..x.x..x.x.x'
        ],
        snare: [
          '....x.......x...', '....x.......x...',
          '....x.......x...', '....x.......x.xx'
        ],
        hat: [
          'x.x.x.x.x.x.x.x.', 'x.x.x.x.x.x.x.x.',
          'x.x.x.x.x.x.x.x.', 'x.x.x.x.x.x.xxx.'
        ]
      }
    },

    /* --- game1: 140 BPM, E-moll, другой грув, 16 тактов ---------------- */
    game1: {
      id: 'game1', bpm: 140, bars: 16, trim: 0.85,
      chords: {
        Em: chord(52, 'm'), C: chord(48, 'M'), G: chord(55, 'M'),
        D: chord(50, 'M'), Am: chord(57, 'm'), B: chord(59, 'M')
      },
      prog: [
        'Em', 'C', 'G', 'D', 'Em', 'C', 'Am', 'B',
        'Em', 'C', 'G', 'D', 'C', 'D', 'B', 'Em'
      ],
      lead:
        'B4:1 E5:1 G5:2 F#5:2 E5:2 B4:2 D5:2 B4:4 | ' +
        'C5:1 E5:1 G5:2 E5:4 D5:2 C5:2 G4:4 | ' +
        'D5:2 G5:2 B5:2 A5:2 G5:2 D5:2 E5:2 F#5:2 | ' +
        'A5:2 F#5:2 D5:2 A4:2 B4:4 C5:2 D5:2 | ' +
        'E5:2 G5:2 B5:2 A5:2 G5:2 E5:2 F#5:2 G5:2 | ' +
        'C5:2 E5:2 G5:2 E5:2 D5:2 C5:2 B4:2 G4:2 | ' +
        'A4:2 C5:2 E5:2 A5:2 G5:2 E5:2 D5:2 C5:2 | ' +
        'B4:2 D#5:2 F#5:2 B5:2 A5:2 F#5:2 D#5:2 B4:2 | ' +
        'G5:2 B5:2 A5:2 G5:2 E5:4 D5:2 B4:2 | ' +
        'E5:2 G5:2 C6:2 B5:2 G5:2 E5:2 D5:2 C5:2 | ' +
        'D5:2 G5:2 B5:2 D6:2 B5:2 A5:2 G5:2 F#5:2 | ' +
        'A5:2 F#5:2 D6:2 A5:2 F#5:2 D5:2 E5:2 F#5:2 | ' +
        'C6:2 B5:2 G5:2 E5:2 D5:2 E5:2 G5:2 A5:2 | ' +
        'F#5:2 A5:2 D6:2 C6:2 A5:2 F#5:2 A5:4 | ' +
        'B5:2 A5:2 F#5:2 D#5:2 B4:4 D#5:2 F#5:2 | ' +
        'E5:8 B4:4 E5:4',
      leadCh: leadCh({
        duty: 0.25, vol: 0.12, gate: 0.82, attack: 0.003,
        decay: 0.04, sustain: 0.7, release: 0.02
      }),
      arp: {
        wave: 'pulse', duty: 0.125, vol: 0.034, gate: 0.5,
        attack: 0.003, decay: 0.03, sustain: 0.45, release: 0.02,
        pattern: [0, 2, 1, 3, 1, 3, 0, 2], step: 2, oct: 12
      },
      bassCh: triangleCh({ vol: 0.19, gate: 0.9, attack: 0.005, release: 0.05 }),
      bass: 'R:3 R:3 O:2 R:2 r:2 F:2 O:2',
      bassOct: -12,
      drums: {
        mul: 1,
        kick: [
          'x..x..x...x.x...', 'x..x..x...x.x...',
          'x..x..x...x.x...', 'x..x..x...x.x.x.'
        ],
        snare: [
          '....x.......x...', '....x.......x...',
          '....x.......x...', '....x.......x.xx'
        ],
        hat: [
          'x.x.x.x.x.x.x.xx', 'x.x.x.x.x.x.x.xx',
          'x.x.x.x.x.x.x.xx', 'x.x.x.x.x.x.xxxx'
        ],
        open: [
          '......x.......x.', '......x.......x.',
          '......x.......x.', '......x.......x.'
        ],
        tom: ['................', '................', '................', '............x.x.']
      }
    },

    /* --- game2: 120 BPM, D-moll, эпик, 16 тактов ----------------------- */
    game2: {
      id: 'game2', bpm: 120, bars: 16, trim: 0.92,
      chords: {
        Dm: chord(50, 'm'), Bb: chord(46, 'M'), F: chord(53, 'M'),
        C: chord(48, 'M'), Gm: chord(43, 'm'), A: chord(57, 'M')
      },
      prog: [
        'Dm', 'Bb', 'F', 'C', 'Dm', 'Bb', 'Gm', 'A',
        'Dm', 'Bb', 'F', 'C', 'Bb', 'C', 'Dm', 'A'
      ],
      lead:
        'D5:4 F5:2 A5:2 D6:4 C6:2 A5:2 | ' +
        'Bb5:4 A5:2 F5:2 D5:4 F5:2 Bb5:2 | ' +
        'C6:4 A5:2 F5:2 C5:4 F5:2 A5:2 | ' +
        'G5:4 E5:2 G5:2 C6:4 Bb5:2 G5:2 | ' +
        'A5:2 D6:2 F6:2 E6:2 D6:2 A5:2 F5:4 | ' +
        'F5:2 Bb5:2 D6:2 C6:2 Bb5:2 F5:2 D5:4 | ' +
        'D5:2 G5:2 Bb5:2 D6:2 C6:2 Bb5:2 G5:4 | ' +
        'A5:4 C#6:2 E6:2 A5:2 E5:2 C#5:4 | ' +
        'D6:6 C6:2 A5:4 F5:4 | ' +
        'Bb5:6 A5:2 F5:4 D5:4 | ' +
        'C6:4 D6:2 C6:2 A5:4 F5:4 | ' +
        'G5:4 Bb5:4 C6:4 E6:4 | ' +
        'D6:2 C6:2 Bb5:2 A5:2 F5:2 A5:2 Bb5:2 D6:2 | ' +
        'E6:2 D6:2 C6:2 Bb5:2 G5:2 A5:2 Bb5:2 C6:2 | ' +
        'D6:8 A5:4 F5:4 | ' +
        'C#6:6 A5:2 E5:4 A5:4',
      leadCh: leadCh({
        duty: 0.5, vol: 0.13, gate: 0.88, attack: 0.005,
        decay: 0.06, sustain: 0.76, release: 0.04,
        vib: { rate: 5.0, depth: 4 }
      }),
      arp: {
        wave: 'pulse', duty: 0.25, vol: 0.038, gate: 0.6,
        attack: 0.004, decay: 0.04, sustain: 0.5, release: 0.03,
        pattern: [0, 1, 2, 3, 2, 1, 3, 2], step: 2, oct: 12
      },
      bassCh: triangleCh({ vol: 0.2, gate: 0.95, attack: 0.006, release: 0.06 }),
      bass: 'R:4 R:4 F:4 O:4',
      bassOct: -12,
      drums: {
        mul: 1,
        kick: [
          'x.......x.......', 'x.......x.......',
          'x.......x...x...', 'x.......x.......'
        ],
        snare: [
          '....x.......x...', '....x.......x...',
          '....x.......x...', '....x.......x.xx'
        ],
        tom: [
          '..x...x...x...x.', '..x...x...x...x.',
          '..x...x...x...x.', '..x...x...x.xxx.'
        ],
        crash: ['x...............', '................', '................', '................'],
        hat: ['..x...x...x...x.', '..x...x...x...x.', '..x...x...x...x.', '..x...x...x...x.']
      }
    },

    /* --- ending: 100 BPM, тёплый финал, G-dur, 8 тактов ---------------- */
    ending: {
      id: 'ending', bpm: 100, bars: 8, trim: 1,
      chords: {
        G: chord(55, 'M'), C: chord(60, 'M'), D: chord(62, 'M'), Em: chord(64, 'm')
      },
      prog: ['G', 'C', 'D', 'Em', 'C', 'D', 'G', 'G'],
      lead:
        'D5:4 G5:2 B5:2 A5:4 G5:4 | ' +
        'E5:4 G5:2 C6:2 B5:4 G5:4 | ' +
        'F#5:4 A5:2 D6:2 C6:4 A5:4 | ' +
        'B5:4 G5:2 E5:2 G5:4 B5:4 | ' +
        'C6:4 B5:2 A5:2 G5:4 E5:4 | ' +
        'A5:4 F#5:2 D5:2 F#5:4 A5:4 | ' +
        'G5:6 B5:2 D6:4 B5:4 | ' +
        'G5:8 D5:4 B4:4',
      leadCh: leadCh({
        duty: 0.5, vol: 0.11, gate: 0.9, attack: 0.008,
        decay: 0.09, sustain: 0.82, release: 0.06,
        vib: { rate: 5.0, depth: 5 }
      }),
      arp: {
        wave: 'triangle', vol: 0.048, gate: 1.0, attack: 0.01,
        decay: 0.15, sustain: 0.6, release: 0.35,
        pattern: [0, 2, 1, 3], step: 4, oct: 12
      },
      bassCh: triangleCh({ vol: 0.18, gate: 0.96, attack: 0.008, release: 0.08 }),
      bass: 'R:6 T:2 F:4 O:4',
      bassOct: -12,
      pad: {
        wave: 'triangle', vol: 0.03, gate: 1.0, attack: 0.25,
        decay: 0.2, sustain: 0.88, release: 0.5, tones: [1, 2], span: 8
      },
      drums: {
        mul: 0.62,
        kick: [
          'x.......x.......', 'x.......x.......',
          'x.......x.......', 'x.......x.......'
        ],
        snare: [
          '....x.......x...', '....x.......x...',
          '....x.......x...', '....x.......x...'
        ],
        hat: [
          '..x...x...x...x.', '..x...x...x...x.',
          '..x...x...x...x.', '..x...x...x...x.'
        ]
      }
    }
  };

  /* ==========================================================================
     2. КОМПИЛЯЦИЯ ТРЕКОВ (чистые данные, без AudioContext)
     ========================================================================== */

  var compiledTracks = {};
  var compileErrors = [];

  function parseSeq(str, spb, id) {
    var events = [];
    var bar = 0;
    var pos = 0;
    var toks = String(str).split(/\s+/);
    for (var i = 0; i < toks.length; i++) {
      var tok = toks[i];
      if (!tok) continue;
      if (tok === '|') {
        if (pos !== spb) throw new Error(id + ': такт ' + (bar + 1) + ' неполный (' + pos + '/' + spb + ')');
        bar++;
        pos = 0;
        continue;
      }
      var parts = tok.split(':');
      var len = parts.length > 1 ? parseInt(parts[1], 10) : 1;
      if (!(len > 0)) throw new Error(id + ': плохая длительность "' + tok + '"');
      if (pos + len > spb) throw new Error(id + ': такт ' + (bar + 1) + ' переполнен "' + tok + '"');
      var step = bar * spb + pos;
      if (parts[0] !== 'r' && parts[0] !== '-') {
        var midi = midiOf(parts[0]);
        if (midi === null) throw new Error(id + ': неизвестная нота "' + parts[0] + '"');
        events.push({ step: step, len: len, midi: midi, vel: 1 });
      }
      pos += len;
    }
    if (pos !== spb) throw new Error(id + ': последний такт неполный (' + pos + '/' + spb + ')');
    return events;
  }

  function parseFigure(str, spb, id) {
    var out = [];
    var pos = 0;
    var toks = String(str).split(/\s+/);
    for (var i = 0; i < toks.length; i++) {
      var tok = toks[i];
      if (!tok) continue;
      if (tok === '|') {
        if (pos !== spb) throw new Error(id + ': фигура баса короче такта (' + pos + ')');
        continue;
      }
      var parts = tok.split(':');
      var len = parts.length > 1 ? parseInt(parts[1], 10) : 1;
      if (!(len > 0)) throw new Error(id + ': плохая длительность баса "' + tok + '"');
      if (pos + len > spb) throw new Error(id + ': бас переполняет такт "' + tok + '"');
      out.push({ pos: pos, len: len, key: parts[0] });
      pos += len;
    }
    if (pos !== spb) throw new Error(id + ': фигура баса не равна такту (' + pos + ')');
    return out;
  }

  function bassOffset(key, ch) {
    switch (key) {
      case 'R': return 0;
      case 'T': return ch.i[1];
      case 'F': return ch.i[2];
      case 'O': return ch.i[3] === undefined ? 12 : ch.i[3];
      case 'L': return -12;
      default: throw new Error('неизвестный тон баса "' + key + '"');
    }
  }

  function compileTrack(def) {
    var spb = 16;
    var bars = def.prog.length;
    if (bars < 8 || bars > 16) throw new Error(def.id + ': тактов ' + bars + ' (нужно 8-16)');
    if (!def.chords) throw new Error(def.id + ': нет аккордов');
    var steps = bars * spb;
    var events = [];
    for (var s = 0; s < steps; s++) events.push([]);

    function add(step, ev) {
      if (step < 0 || step >= steps) throw new Error(def.id + ': событие вне лупа (шаг ' + step + ')');
      events[step].push(ev);
    }

    // Аккорды прогрессии
    for (var b = 0; b < bars; b++) {
      if (!def.chords[def.prog[b]]) throw new Error(def.id + ': неизвестный аккорд "' + def.prog[b] + '"');
    }

    // Вед (pulse 1)
    if (!def.leadCh) throw new Error(def.id + ': нет канала leadCh');
    var lead = parseSeq(def.lead, spb, def.id);
    for (var i = 0; i < lead.length; i++) {
      add(lead[i].step, { ch: def.leadCh, midi: lead[i].midi, len: lead[i].len, vel: 1 });
    }

    // Бас (треугольник) — фигура на каждый аккорд
    if (!def.bassCh) throw new Error(def.id + ': нет канала bassCh');
    var fig = parseFigure(def.bass, spb, def.id);
    var bassOct = def.bassOct === undefined ? -12 : def.bassOct;
    for (var bb = 0; bb < bars; bb++) {
      var bch = def.chords[def.prog[bb]];
      var root = bch.r + bassOct;
      for (var f = 0; f < fig.length; f++) {
        if (fig[f].key === 'r') continue; // пауза баса
        var off = bassOffset(fig[f].key, bch);
        add(bb * spb + fig[f].pos, { ch: def.bassCh, midi: root + off, len: fig[f].len, vel: 1 });
      }
    }

    // Арпеджио (pulse 2 / треугольник) из тонов аккорда
    if (!def.arp) throw new Error(def.id + ': нет арпеджио');
    var arp = def.arp;
    if (!arp.pattern || !arp.pattern.length) throw new Error(def.id + ': пустой pattern арпеджио');
    if (arp.pattern.length * arp.step !== spb) {
      throw new Error(def.id + ': арпеджио ' + arp.pattern.length + 'x' + arp.step + ' != ' + spb);
    }
    var arpCh = merge(arp, {});
    for (var ab = 0; ab < bars; ab++) {
      var ach = def.chords[def.prog[ab]];
      for (var k = 0; k < arp.pattern.length; k++) {
        var idx = arp.pattern[k] % ach.i.length;
        var note = ach.r + ach.i[idx] + (arp.oct || 0);
        add(ab * spb + k * arp.step, { ch: arpCh, midi: note, len: arp.step, vel: 1 });
      }
    }

    // Пэд (длинные тоны) — опционально
    if (def.pad) {
      var pad = def.pad;
      if (pad.tones.length * pad.span !== spb) throw new Error(def.id + ': пэд не равен такту');
      var padCh = merge(pad, {});
      for (var pb = 0; pb < bars; pb++) {
        var pch = def.chords[def.prog[pb]];
        for (var pi = 0; pi < pad.tones.length; pi++) {
          var pidx = pad.tones[pi] % pch.i.length;
          add(pb * spb + pi * pad.span, {
            ch: padCh, midi: pch.r + pch.i[pidx], len: pad.span, vel: 1
          });
        }
      }
    }

    // Барабаны (шум)
    if (!def.drums) throw new Error(def.id + ': нет барабанов');
    var drumInstruments = ['kick', 'snare', 'hat', 'open', 'tom', 'crash'];
    var drumCount = 0;
    for (var di = 0; di < drumInstruments.length; di++) {
      var inst = drumInstruments[di];
      var pats = def.drums[inst];
      if (!pats) continue;
      if (!pats.length) throw new Error(def.id + ': пустой паттерн ' + inst);
      for (var db = 0; db < bars; db++) {
        var row = pats[db % pats.length];
        if (typeof row !== 'string' || row.length !== spb) {
          throw new Error(def.id + ': паттерн ' + inst + ' должен быть ' + spb + ' шагов');
        }
        for (var ds = 0; ds < spb; ds++) {
          var c = row.charAt(ds);
          if (c === '.' || c === ' ') continue;
          if (c !== 'x' && c !== 'X') throw new Error(def.id + ': символ "' + c + '" в ' + inst);
          add(db * spb + ds, {
            drum: inst,
            vel: c === 'X' ? 1.3 : 1,
            mul: def.drums.mul === undefined ? 1 : def.drums.mul
          });
          drumCount++;
        }
      }
    }

    var noteCount = 0;
    var drumEvents = 0;
    var minMidi = 999;
    var maxMidi = -1;
    for (var e = 0; e < events.length; e++) {
      for (var j = 0; j < events[e].length; j++) {
        var ev = events[e][j];
        if (ev.drum) {
          drumEvents++;
        } else {
          noteCount++;
          if (ev.midi < minMidi) minMidi = ev.midi;
          if (ev.midi > maxMidi) maxMidi = ev.midi;
          if (!(ev.midi > 12 && ev.midi < 108)) throw new Error(def.id + ': нота вне диапазона');
        }
      }
    }
    if (!noteCount) throw new Error(def.id + ': нет нот');
    if (!drumCount) throw new Error(def.id + ': нет барабанов');

    return {
      id: def.id,
      bpm: def.bpm,
      bars: bars,
      steps: steps,
      stepDur: 60 / (def.bpm * 4),
      events: events,
      def: def,
      meta: {
        noteCount: noteCount,
        drumEvents: drumEvents,
        minMidi: minMidi,
        maxMidi: maxMidi,
        hasPad: !!def.pad,
        hasWind: !!def.wind,
        drums: drumInstruments.filter(function (n) { return !!def.drums[n]; })
      }
    };
  }

  var compileFailed = {};

  function getTrack(id) {
    if (compiledTracks[id]) return compiledTracks[id];
    if (compileFailed[id]) return null;
    var def = TRACKS[id];
    if (!def) return null;
    try {
      var tr = compileTrack(def);
      compiledTracks[id] = tr;
      return tr;
    } catch (e) {
      compileFailed[id] = true;
      compileErrors.push(String((e && e.message) || e));
      return null;
    }
  }

  /* ==========================================================================
     3. AudioContext, шины, мастер
     ========================================================================== */

  var ctx = null;
  var master = null;
  var compressor = null;
  var limiter = null;
  var musicBus = null;
  var sfxBus = null;
  var noiseBuffer = null;
  var waveCache = {};
  var volume = 0.8;
  var muted = false;
  var paused = false;
  var pendingMusic = null;

  var music = null;          // активный трек
  var fadeLog = [];          // история fade in/out (диагностика)
  var schedulerTimer = null;
  var schedulerErrors = 0;
  var stepToggle = false;
  var lastStepAt = 0;

  var LOOKAHEAD = 0.1;       // горизонт планирования, сек
  var TICK_MS = 25;          // период планировщика, мс

  // Мягкий лимитер после компрессора: прозрачен до 0.75, гарантирует <= 0.98.
  function makeLimiterCurve() {
    var n = 2048;
    var curve = new Float32Array(n);
    for (var i = 0; i < n; i++) {
      var x = (i / (n - 1)) * 2 - 1;
      var a = Math.abs(x);
      var sign = x < 0 ? -1 : 1;
      var y;
      if (a <= 0.75) {
        y = a;
      } else {
        var t = (a - 0.75) / 0.25;
        y = 0.75 + 0.23 * (1 - Math.pow(1 - t, 2));
      }
      curve[i] = sign * y;
    }
    return curve;
  }

  function configureCompressor(c) {
    if (!c) return;
    if (c.threshold) c.threshold.value = -12;
    if (c.knee) c.knee.value = 24;
    if (c.ratio) c.ratio.value = 6;
    if (c.attack) c.attack.value = 0.004;
    if (c.release) c.release.value = 0.22;
  }

  function makeNoiseBuffer() {
    var rate = ctx.sampleRate || 44100;
    var len = Math.max(256, Math.floor(rate));
    var buf = ctx.createBuffer(1, len, rate);
    var data = buf.getChannelData(0);
    for (var i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    return buf;
  }

  // Создать контекст и мастер-цепочку: [music/sfx] -> master -> limiter -> out
  function ensure() {
    if (ctx) return ctx;
    var AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    try {
      ctx = new AC();
    } catch (e) {
      ctx = null;
      return null;
    }
    try {
      master = ctx.createGain();
      compressor = ctx.createDynamicsCompressor();
      configureCompressor(compressor);
      master.connect(compressor);
      limiter = null;
      if (typeof ctx.createWaveShaper === 'function') {
        try {
          limiter = ctx.createWaveShaper();
          limiter.curve = makeLimiterCurve();
          try { limiter.oversample = '2x'; } catch (e) { /* Safari */ }
          compressor.connect(limiter);
          limiter.connect(ctx.destination);
        } catch (e) {
          limiter = null;
        }
      }
      if (!limiter) compressor.connect(ctx.destination);
      musicBus = ctx.createGain();
      musicBus.gain.value = 1;
      musicBus.connect(master);
      sfxBus = ctx.createGain();
      sfxBus.gain.value = 0.9;
      sfxBus.connect(master);
      master.gain.value = muted ? 0 : volume;
      waveCache = {};
      noiseBuffer = makeNoiseBuffer();
    } catch (e) {
      ctx = null;
      master = null;
      musicBus = null;
      sfxBus = null;
      return null;
    }
    return ctx;
  }

  function applyMasterGain(now) {
    if (!master) return;
    var target = muted ? 0 : volume;
    try {
      var g = master.gain;
      g.cancelScheduledValues(now);
      g.setValueAtTime(g.value, now);
      g.linearRampToValueAtTime(target, now + 0.04);
    } catch (e) {
      try { master.gain.value = target; } catch (e2) { /* ignore */ }
    }
  }

  function applyMusicDuck(now) {
    if (!musicBus) return;
    var target = paused ? 0.18 : 1;
    try {
      var g = musicBus.gain;
      g.cancelScheduledValues(now);
      g.setValueAtTime(g.value, now);
      g.linearRampToValueAtTime(target, now + 0.25);
    } catch (e) {
      try { musicBus.gain.value = target; } catch (e2) { /* ignore */ }
    }
  }

  function unlock() {
    var c = ensure();
    if (!c) return false;
    try {
      if (c.state === 'suspended' && typeof c.resume === 'function') {
        var p = c.resume();
        if (p && typeof p.then === 'function') p.then(null, function () {});
      }
    } catch (e) { /* контекст может не проснуться — работаем дальше */ }
    // iOS/Safari: короткий тихий буфер как первый жест
    try {
      var silent = c.createBuffer(1, 1, c.sampleRate || 44100);
      var src = c.createBufferSource();
      src.buffer = silent;
      src.connect(c.destination);
      src.start(0);
    } catch (e) { /* не критично */ }
    if (musicBus) {
      try { musicBus.gain.value = paused ? 0.18 : 1; } catch (e) { /* ignore */ }
    }
    if (pendingMusic) {
      var next = pendingMusic;
      pendingMusic = null;
      playMusic(next);
    }
    return true;
  }

  function isReady() {
    if (!ctx) return false;
    if (ctx.state === undefined) return true;
    return ctx.state === 'running';
  }

  /* ==========================================================================
     4. СИНТЕЗ: пульс, ноты, барабаны
     ========================================================================== */

  function pulseWave(duty) {
    if (!ctx) return null;
    var key = 'd' + duty;
    if (waveCache[key]) return waveCache[key];
    try {
      var n = 32;
      var real = new Float32Array(n + 1);
      var imag = new Float32Array(n + 1);
      for (var i = 1; i <= n; i++) {
        real[i] = (2 / (i * Math.PI)) * Math.sin(i * Math.PI * duty);
      }
      var w = ctx.createPeriodicWave(real, imag, { disableNormalization: true });
      waveCache[key] = w;
      return w;
    } catch (e) {
      return null;
    }
  }

  // Пульсы с малой скважностью тише по амплитуде — компенсируем.
  function dutyGain(duty) {
    if (duty <= 0.13) return 1.75;
    if (duty <= 0.26) return 1.3;
    return 1;
  }

  function noteVolume(ch) {
    var v = ch.vol === undefined ? 0.1 : ch.vol;
    if (ch.wave === 'pulse') v *= dutyGain(ch.duty || 0.5);
    return v;
  }

  function scheduleNote(m, ev, when) {
    var ch = ev.ch;
    var stepDur = m.tr.stepDur;
    var vol = noteVolume(ch) * (ev.vel === undefined ? 1 : ev.vel);
    var attack = ch.attack === undefined ? 0.005 : ch.attack;
    var release = ch.release === undefined ? 0.03 : ch.release;
    var sust = ch.sustain === undefined ? 0.78 : ch.sustain;
    var gate = stepDur * ev.len * (ch.gate === undefined ? 0.9 : ch.gate);
    var t = when;
    var end = t + Math.max(gate, attack + 0.01);

    var osc = ctx.createOscillator();
    if (ch.wave === 'pulse') {
      var pw = pulseWave(ch.duty || 0.5);
      if (pw) {
        try { osc.setPeriodicWave(pw); } catch (e) { osc.type = 'square'; }
      } else {
        osc.type = 'square';
      }
    } else if (ch.wave === 'saw') {
      osc.type = 'sawtooth';
    } else {
      osc.type = 'triangle';
    }

    osc.frequency.setValueAtTime(freqOf(ev.midi), t);
    var g = ctx.createGain();
    var decay = ch.decay === undefined ? 0.05 : ch.decay;
    var decayEnd = t + attack + Math.min(decay, Math.max(0.005, gate - attack));
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(vol, t + attack);
    g.gain.linearRampToValueAtTime(vol * sust, decayEnd);
    if (decayEnd < end) g.gain.setValueAtTime(vol * sust, end);
    g.gain.linearRampToValueAtTime(0.0001, end + release);
    osc.connect(g);
    g.connect(m.bus);

    var lfo = null;
    var lfoGain = null;
    if (ch.vib && ev.len * stepDur > 0.28) {
      try {
        lfo = ctx.createOscillator();
        lfo.type = 'sine';
        lfo.frequency.value = ch.vib.rate || 5;
        lfoGain = ctx.createGain();
        lfoGain.gain.value = ch.vib.depth || 5;
        lfo.connect(lfoGain);
        lfoGain.connect(osc.detune);
        lfo.start(t);
        lfo.stop(end + release + 0.03);
      } catch (e) {
        lfo = null;
        lfoGain = null;
      }
    }

    osc.start(t);
    osc.stop(end + release + 0.03);
    osc.onended = function () {
      try { osc.disconnect(); g.disconnect(); } catch (e) { /* ignore */ }
      if (lfo) {
        try { lfo.disconnect(); if (lfoGain) lfoGain.disconnect(); } catch (e) { /* ignore */ }
      }
    };
  }

  var DRUM_VOL = {
    kick: 0.52, snare: 0.3, hat: 0.065, open: 0.055,
    tom: 0.28, crash: 0.12
  };

  function drumKick(t, v, bus) {
    var o = ctx.createOscillator();
    o.type = 'sine';
    o.frequency.setValueAtTime(150, t);
    o.frequency.exponentialRampToValueAtTime(42, t + 0.12);
    var g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(DRUM_VOL.kick * v, t + 0.006);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.26);
    o.connect(g);
    g.connect(bus);
    o.start(t);
    o.stop(t + 0.3);
    o.onended = function () {
      try { o.disconnect(); g.disconnect(); } catch (e) { /* ignore */ }
    };
    noiseHit(t, 0.02, DRUM_VOL.kick * v * 0.18, 'highpass', 1800, bus);
  }

  function drumSnare(t, v, bus) {
    noiseHit(t, 0.16, DRUM_VOL.snare * v, 'highpass', 1300, bus);
    toneHit(t, 0.09, DRUM_VOL.snare * v * 0.4, 190, 110, 'triangle', bus);
  }

  function drumHat(t, v, bus, open) {
    noiseHit(t, open ? 0.15 : 0.035, (open ? DRUM_VOL.open : DRUM_VOL.hat) * v,
      'highpass', open ? 6500 : 8000, bus);
  }

  function drumTom(t, v, bus) {
    toneHit(t, 0.19, DRUM_VOL.tom * v, 190, 96, 'sine', bus);
  }

  function drumCrash(t, v, bus) {
    noiseHit(t, 1.0, DRUM_VOL.crash * v, 'highpass', 4200, bus);
    noiseHit(t, 0.5, DRUM_VOL.crash * v * 0.5, 'bandpass', 2800, bus, 0.7);
  }

  // Одиночный шумовой удар в шину.
  function noiseHit(t, dur, vol, filterType, freq, bus, q) {
    if (!noiseBuffer) return;
    var src = ctx.createBufferSource();
    src.buffer = noiseBuffer;
    src.loop = true;
    var f = ctx.createBiquadFilter();
    f.type = filterType || 'highpass';
    f.frequency.setValueAtTime(Math.max(20, freq || 1000), t);
    if (q !== undefined) f.Q.value = q;
    var g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(vol, t + 0.004);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f);
    f.connect(g);
    g.connect(bus);
    src.start(t);
    src.stop(t + dur + 0.03);
    src.onended = function () {
      try { src.disconnect(); f.disconnect(); g.disconnect(); } catch (e) { /* ignore */ }
    };
  }

  // Короткий тон с глиссандо (для барабанов/SFX).
  function toneHit(t, dur, vol, from, to, wave, bus, duty) {
    var o = ctx.createOscillator();
    if (wave === 'pulse') {
      var pw = pulseWave(duty || 0.5);
      if (pw) {
        try { o.setPeriodicWave(pw); } catch (e) { o.type = 'square'; }
      } else {
        o.type = 'square';
      }
    } else {
      o.type = wave || 'sine';
    }
    o.frequency.setValueAtTime(Math.max(20, from), t);
    if (to && to !== from) o.frequency.exponentialRampToValueAtTime(Math.max(20, to), t + dur);
    var g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(vol, t + 0.004);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g);
    g.connect(bus);
    o.start(t);
    o.stop(t + dur + 0.02);
    o.onended = function () {
      try { o.disconnect(); g.disconnect(); } catch (e) { /* ignore */ }
    };
  }

  function scheduleDrum(m, ev, when) {
    var v = (ev.vel || 1) * (ev.mul === undefined ? 1 : ev.mul);
    var bus = m.bus;
    switch (ev.drum) {
      case 'kick': drumKick(when, v, bus); break;
      case 'snare': drumSnare(when, v, bus); break;
      case 'hat': drumHat(when, v, bus, false); break;
      case 'open': drumHat(when, v, bus, true); break;
      case 'tom': drumTom(when, v, bus); break;
      case 'crash': drumCrash(when, v, bus); break;
      default: break;
    }
  }

  function scheduleStep(m, step, when) {
    var evs = m.tr.events[step];
    if (!evs || !evs.length) return;
    for (var i = 0; i < evs.length; i++) {
      var ev = evs[i];
      try {
        if (ev.drum) scheduleDrum(m, ev, when);
        else scheduleNote(m, ev, when);
      } catch (e) {
        schedulerErrors++;
      }
    }
  }

  /* ==========================================================================
     5. ПЛАНИРОВЩИК И УПРАВЛЕНИЕ МУЗЫКОЙ
     ========================================================================== */

  function startScheduler() {
    if (schedulerTimer !== null) return;
    try {
      schedulerTimer = setInterval(tick, TICK_MS);
    } catch (e) {
      schedulerTimer = null;
    }
  }

  function stopScheduler() {
    if (schedulerTimer === null) return;
    try { clearInterval(schedulerTimer); } catch (e) { /* ignore */ }
    schedulerTimer = null;
  }

  function tick() {
    if (!ctx || !music) return;
    try {
      scheduleAhead(music);
    } catch (e) {
      schedulerErrors++;
    }
  }

  function scheduleAhead(m) {
    var now = ctx.currentTime;
    var stepDur = m.tr.stepDur;
    // После сна вкладки/фонового throttle — не пытаемся догнать всё, а
    // выравниваем фазу, чтобы не было «пулемёта» из нот.
    if (m.nextTime < now - 0.3) {
      var skip = Math.ceil((now - m.nextTime) / stepDur);
      m.nextTime += skip * stepDur;
      m.step = (m.step + skip) % m.tr.steps;
    }
    var horizon = now + LOOKAHEAD;
    var guard = 0;
    while (m.nextTime < horizon && guard < 128) {
      scheduleStep(m, m.step, m.nextTime);
      m.nextTime += stepDur;
      m.step = (m.step + 1) % m.tr.steps;
      guard++;
    }
  }

  function logFade(kind, from, to, fade) {
    fadeLog.push({
      kind: kind, from: from, to: to, fade: fade,
      at: ctx ? ctx.currentTime : 0
    });
    if (fadeLog.length > 24) fadeLog.shift();
  }

  function startWind(m) {
    var w = m.tr.def.wind;
    if (!w || !noiseBuffer) return;
    try {
      var src = ctx.createBufferSource();
      src.buffer = noiseBuffer;
      src.loop = true;
      var f = ctx.createBiquadFilter();
      f.type = 'lowpass';
      f.frequency.value = w.freq || 850;
      f.Q.value = w.q || 0.7;
      var g = ctx.createGain();
      g.gain.value = w.vol || 0.05;
      var lfo = ctx.createOscillator();
      lfo.type = 'sine';
      lfo.frequency.value = w.lfo || 0.06;
      var lfoGain = ctx.createGain();
      lfoGain.gain.value = (w.vol || 0.05) * (w.depth || 0.5);
      lfo.connect(lfoGain);
      lfoGain.connect(g.gain);
      src.connect(f);
      f.connect(g);
      g.connect(m.bus);
      var now = ctx.currentTime;
      src.start(now);
      lfo.start(now);
      m.wind = { src: src, lfo: lfo, lfoGain: lfoGain, filter: f, gain: g };
    } catch (e) {
      m.wind = null;
    }
  }

  function releaseTrack(m) {
    if (!m) return;
    if (m.wind) {
      try { m.wind.src.stop(0); } catch (e) { /* ignore */ }
      try { m.wind.lfo.stop(0); } catch (e) { /* ignore */ }
      try { m.wind.src.disconnect(); } catch (e) { /* ignore */ }
      try { m.wind.lfo.disconnect(); } catch (e) { /* ignore */ }
      try { m.wind.lfoGain.disconnect(); } catch (e) { /* ignore */ }
      try { m.wind.filter.disconnect(); } catch (e) { /* ignore */ }
      try { m.wind.gain.disconnect(); } catch (e) { /* ignore */ }
      m.wind = null;
    }
    try { m.bus.disconnect(); } catch (e) { /* ignore */ }
  }

  function scheduleRelease(m, when) {
    var delay = (when - ctx.currentTime) * 1000 + 120;
    if (!(delay > 0)) delay = 120;
    try {
      var id = setTimeout(function () { releaseTrack(m); }, delay);
      if (m.timeouts) m.timeouts.push(id);
    } catch (e) {
      releaseTrack(m);
    }
  }

  function startMusic(tr) {
    if (!ctx) return;
    var now = ctx.currentTime;
    var bus = ctx.createGain();
    var trim = tr.def.trim === undefined ? 1 : tr.def.trim;
    try {
      bus.gain.setValueAtTime(0.0001, now);
      bus.gain.linearRampToValueAtTime(trim, now + 0.5);
    } catch (e) {
      try { bus.gain.value = 1; } catch (e2) { /* ignore */ }
    }
    bus.connect(musicBus);
    music = {
      id: tr.id,
      tr: tr,
      bus: bus,
      step: 0,
      nextTime: now + 0.05,
      timeouts: [],
      wind: null
    };
    logFade('start', 0.0001, trim, 0.5);
    if (tr.def.wind) startWind(music);
    if (paused) {
      // новый трек всегда звучит полноценно (страховка для переходов из паузы)
      paused = false;
      if (musicBus) {
        try {
          musicBus.gain.cancelScheduledValues(now);
          musicBus.gain.setValueAtTime(0.18, now);
          musicBus.gain.linearRampToValueAtTime(1, now + 0.3);
        } catch (e) { /* ignore */ }
      }
    }
    startScheduler();
  }

  function stopMusicInternal(fade) {
    var m = music;
    music = null;
    stopScheduler();
    if (!m || !ctx) return;
    var f = (typeof fade === 'number' && isFinite(fade)) ? Math.max(0, Math.min(3, fade)) : 0.4;
    var now = ctx.currentTime;
    var from = 0.0001;
    try {
      var g = m.bus.gain;
      from = g.value;
      g.cancelScheduledValues(now);
      g.setValueAtTime(g.value, now);
      g.linearRampToValueAtTime(0.0001, now + f);
    } catch (e) { /* ignore */ }
    logFade('stop', from, 0.0001, f);
    scheduleRelease(m, now + f + 0.08);
  }

  function playMusic(id) {
    try {
      if (id === undefined || id === null || id === 'none') {
        stopMusic();
        return true;
      }
      if (!TRACKS[id]) return false;
      if (!ctx) {
        pendingMusic = id;
        return false;
      }
      if (music && music.id === id) return true; // идемпотентно
      var tr = getTrack(id);
      if (!tr) return false;
      if (music) stopMusicInternal(0.35);
      pendingMusic = null;
      startMusic(tr);
      return true;
    } catch (e) {
      return false;
    }
  }

  function stopMusic(fade) {
    pendingMusic = null;
    stopMusicInternal(fade);
  }

  function pauseMusic() {
    paused = true;
    if (ctx) applyMusicDuck(ctx.currentTime);
  }

  function resumeMusic() {
    paused = false;
    if (ctx) applyMusicDuck(ctx.currentTime);
  }

  function getCurrentMusic() {
    return music ? music.id : (pendingMusic || null);
  }

  /* ==========================================================================
     6. SFX (все имена из контракта §3 + UI)
     ========================================================================== */

  function sfxTone(o) {
    if (!ctx) return;
    var t = o.t === undefined ? ctx.currentTime + 0.004 : o.t;
    var dur = o.dur || 0.1;
    var vol = o.vol === undefined ? 0.15 : o.vol;
    toneHit(t, dur, vol, o.freq, o.to, o.wave || 'sine', sfxBus, o.duty);
  }

  function sfxNoise(o) {
    if (!ctx || !noiseBuffer) return;
    var t = o.t === undefined ? ctx.currentTime + 0.004 : o.t;
    var dur = o.dur || 0.08;
    var vol = o.vol === undefined ? 0.1 : o.vol;
    var src = ctx.createBufferSource();
    src.buffer = noiseBuffer;
    src.loop = true;
    var f = ctx.createBiquadFilter();
    f.type = o.filter || 'highpass';
    f.frequency.setValueAtTime(Math.max(20, o.freq || 1000), t);
    if (o.to) f.frequency.exponentialRampToValueAtTime(Math.max(20, o.to), t + dur);
    if (o.q !== undefined) f.Q.value = o.q;
    var g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(vol, t + (o.attack === undefined ? 0.004 : o.attack));
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f);
    f.connect(g);
    g.connect(sfxBus);
    src.start(t);
    src.stop(t + dur + 0.03);
    src.onended = function () {
      try { src.disconnect(); f.disconnect(); g.disconnect(); } catch (e) { /* ignore */ }
    };
  }

  var SFX = {};

  SFX.jump = function (t) {
    sfxTone({ t: t, wave: 'pulse', duty: 0.25, freq: 240, to: 680, dur: 0.13, vol: 0.12 });
  };

  SFX.land = function (t) {
    sfxTone({ t: t, wave: 'sine', freq: 150, to: 55, dur: 0.12, vol: 0.17 });
    sfxNoise({ t: t, filter: 'lowpass', freq: 600, dur: 0.08, vol: 0.07 });
  };

  SFX.step = function (t) {
    // Детерминированная альтернация тембра, без случайности.
    var hi = stepToggle ? 900 : 700;
    stepToggle = !stepToggle;
    lastStepAt = t;
    sfxNoise({ t: t, filter: 'lowpass', freq: hi, dur: 0.045, vol: 0.03 });
  };

  SFX['switch'] = function (t) {
    sfxTone({ t: t, wave: 'pulse', duty: 0.5, freq: 520, to: 780, dur: 0.07, vol: 0.1 });
    sfxTone({ t: t + 0.055, wave: 'pulse', duty: 0.5, freq: 780, dur: 0.08, vol: 0.09 });
  };

  SFX.headbutt = function (t) {
    sfxTone({ t: t, wave: 'pulse', duty: 0.5, freq: 220, to: 90, dur: 0.12, vol: 0.14 });
    sfxNoise({ t: t, filter: 'lowpass', freq: 700, dur: 0.07, vol: 0.08 });
  };

  SFX['break'] = function (t) {
    sfxNoise({ t: t, filter: 'highpass', freq: 2200, dur: 0.12, vol: 0.11 });
    sfxNoise({ t: t + 0.035, filter: 'highpass', freq: 3100, dur: 0.12, vol: 0.1 });
    sfxNoise({ t: t + 0.075, filter: 'bandpass', freq: 3800, dur: 0.14, vol: 0.08, q: 0.8 });
    sfxTone({ t: t, wave: 'sine', freq: 1800, to: 900, dur: 0.09, vol: 0.05 });
  };

  SFX.sword = function (t) {
    sfxNoise({ t: t, filter: 'bandpass', freq: 2600, q: 1.6, dur: 0.11, vol: 0.11 });
    sfxTone({ t: t, wave: 'pulse', duty: 0.25, freq: 900, to: 380, dur: 0.1, vol: 0.07 });
  };

  SFX.bow = function (t) {
    sfxTone({ t: t, wave: 'triangle', freq: 420, to: 160, dur: 0.11, vol: 0.13 });
    sfxNoise({ t: t, filter: 'bandpass', freq: 1500, q: 1.2, dur: 0.06, vol: 0.05 });
  };

  SFX.arrowHit = function (t) {
    sfxNoise({ t: t, filter: 'bandpass', freq: 1200, q: 1.2, dur: 0.07, vol: 0.12 });
    sfxTone({ t: t, wave: 'sine', freq: 300, to: 120, dur: 0.06, vol: 0.08 });
  };

  SFX.hookShoot = function (t) {
    sfxNoise({ t: t, filter: 'bandpass', freq: 700, to: 2600, q: 1.4, dur: 0.16, vol: 0.09 });
    sfxTone({ t: t, wave: 'triangle', freq: 300, to: 520, dur: 0.13, vol: 0.06 });
  };

  SFX.hookHit = function (t) {
    sfxTone({ t: t, wave: 'pulse', duty: 0.5, freq: 1200, to: 700, dur: 0.08, vol: 0.1 });
    sfxNoise({ t: t, filter: 'highpass', freq: 3000, dur: 0.05, vol: 0.06 });
  };

  SFX.hookDetach = function (t) {
    sfxTone({ t: t, wave: 'pulse', duty: 0.25, freq: 700, to: 330, dur: 0.09, vol: 0.09 });
  };

  SFX.lever = function (t) {
    sfxNoise({ t: t, filter: 'lowpass', freq: 500, dur: 0.07, vol: 0.12 });
    sfxTone({ t: t, wave: 'pulse', duty: 0.25, freq: 170, to: 120, dur: 0.08, vol: 0.08 });
  };

  SFX.plateOn = function (t) {
    sfxTone({ t: t, wave: 'sine', freq: 240, to: 190, dur: 0.07, vol: 0.12 });
    sfxNoise({ t: t, filter: 'lowpass', freq: 700, dur: 0.04, vol: 0.05 });
  };

  SFX.plateOff = function (t) {
    sfxTone({ t: t, wave: 'sine', freq: 190, to: 150, dur: 0.08, vol: 0.09 });
  };

  SFX.doorOpen = function (t) {
    sfxNoise({ t: t, filter: 'lowpass', freq: 280, to: 900, dur: 0.5, vol: 0.1 });
    sfxTone({ t: t, wave: 'sine', freq: 70, to: 110, dur: 0.45, vol: 0.13 });
  };

  SFX.doorClose = function (t) {
    sfxNoise({ t: t, filter: 'lowpass', freq: 800, to: 240, dur: 0.34, vol: 0.1 });
    sfxTone({ t: t, wave: 'sine', freq: 110, to: 58, dur: 0.28, vol: 0.15 });
  };

  SFX.rune = function (t) {
    // Магический аккорд E6-G6-B6 + шлейф.
    sfxTone({ t: t, wave: 'sine', freq: 1318.5, dur: 0.45, vol: 0.055 });
    sfxTone({ t: t + 0.07, wave: 'sine', freq: 1568, dur: 0.45, vol: 0.05 });
    sfxTone({ t: t + 0.14, wave: 'sine', freq: 1975.5, dur: 0.6, vol: 0.05 });
    sfxTone({ t: t + 0.14, wave: 'triangle', freq: 2637, dur: 0.5, vol: 0.03 });
    sfxNoise({ t: t, filter: 'highpass', freq: 4000, dur: 0.35, vol: 0.025 });
  };

  SFX.checkpoint = function (t) {
    sfxTone({ t: t, wave: 'triangle', freq: 440, dur: 0.22, vol: 0.1 });
    sfxTone({ t: t + 0.1, wave: 'triangle', freq: 659.25, dur: 0.38, vol: 0.09 });
    sfxTone({ t: t + 0.2, wave: 'sine', freq: 880, dur: 0.3, vol: 0.035 });
  };

  SFX.hurt = function (t) {
    sfxTone({ t: t, wave: 'pulse', duty: 0.5, freq: 380, to: 150, dur: 0.22, vol: 0.15 });
    sfxNoise({ t: t, filter: 'lowpass', freq: 1200, to: 400, dur: 0.14, vol: 0.07 });
  };

  SFX.death = function (t) {
    sfxTone({ t: t, wave: 'pulse', duty: 0.5, freq: 320, to: 55, dur: 0.65, vol: 0.14 });
    sfxNoise({ t: t, filter: 'lowpass', freq: 500, to: 90, dur: 0.55, vol: 0.09 });
    sfxTone({ t: t + 0.12, wave: 'triangle', freq: 160, to: 40, dur: 0.55, vol: 0.07 });
  };

  SFX.respawn = function (t) {
    var notes = [330, 440, 554, 660];
    for (var i = 0; i < notes.length; i++) {
      sfxTone({ t: t + i * 0.06, wave: 'triangle', freq: notes[i], dur: 0.3, vol: 0.07 });
    }
    sfxNoise({ t: t, filter: 'highpass', freq: 2500, dur: 0.28, vol: 0.02 });
  };

  SFX.block = function (t) {
    sfxNoise({ t: t, filter: 'highpass', freq: 3000, dur: 0.1, vol: 0.1 });
    sfxTone({ t: t, wave: 'pulse', duty: 0.5, freq: 1400, to: 900, dur: 0.09, vol: 0.08 });
    sfxTone({ t: t, wave: 'sine', freq: 2100, dur: 0.12, vol: 0.04 });
  };

  SFX.enemyHit = function (t) {
    sfxNoise({ t: t, filter: 'lowpass', freq: 900, dur: 0.07, vol: 0.13 });
    sfxTone({ t: t, wave: 'pulse', duty: 0.5, freq: 180, to: 110, dur: 0.08, vol: 0.09 });
  };

  SFX.enemyDie = function (t) {
    sfxTone({ t: t, wave: 'pulse', duty: 0.5, freq: 320, to: 70, dur: 0.45, vol: 0.12 });
    sfxNoise({ t: t, filter: 'bandpass', freq: 1200, to: 300, dur: 0.4, vol: 0.09 });
  };

  SFX.exit = function (t) {
    sfxTone({ t: t, wave: 'pulse', duty: 0.25, freq: 523.25, dur: 0.22, vol: 0.09 });
    sfxTone({ t: t + 0.1, wave: 'pulse', duty: 0.25, freq: 659.25, dur: 0.25, vol: 0.085 });
    sfxTone({ t: t + 0.2, wave: 'pulse', duty: 0.25, freq: 783.99, dur: 0.3, vol: 0.08 });
    sfxTone({ t: t + 0.3, wave: 'sine', freq: 1046.5, dur: 0.5, vol: 0.05 });
    sfxNoise({ t: t, filter: 'highpass', freq: 2500, to: 6000, dur: 0.7, vol: 0.03 });
  };

  SFX.lava = function (t) {
    sfxNoise({ t: t, filter: 'lowpass', freq: 1600, to: 500, dur: 0.4, vol: 0.1 });
    sfxNoise({ t: t + 0.05, filter: 'highpass', freq: 2500, dur: 0.05, vol: 0.05 });
    sfxNoise({ t: t + 0.17, filter: 'highpass', freq: 3200, dur: 0.04, vol: 0.04 });
  };

  SFX.win = function (t) {
    var seq = [523.25, 659.25, 783.99, 1046.5];
    for (var i = 0; i < seq.length; i++) {
      sfxTone({
        t: t + i * 0.12, wave: 'pulse', duty: 0.25,
        freq: seq[i], dur: i === seq.length - 1 ? 0.8 : 0.35, vol: 0.085
      });
    }
    sfxTone({ t: t, wave: 'triangle', freq: 130.81, dur: 0.7, vol: 0.1 });
    sfxTone({ t: t + 0.12, wave: 'triangle', freq: 196, dur: 0.6, vol: 0.07 });
  };

  SFX.lose = function (t) {
    var seq = [659.25, 523.25, 440, 349.23];
    for (var i = 0; i < seq.length; i++) {
      sfxTone({
        t: t + i * 0.14, wave: 'triangle',
        freq: seq[i], dur: i === seq.length - 1 ? 0.8 : 0.32, vol: 0.08
      });
    }
    sfxTone({ t: t, wave: 'sine', freq: 164.81, dur: 0.9, vol: 0.07 });
  };

  SFX.uiMove = function (t) {
    sfxTone({ t: t, wave: 'triangle', freq: 880, dur: 0.035, vol: 0.045 });
  };

  SFX.uiClick = function (t) {
    sfxTone({ t: t, wave: 'pulse', duty: 0.25, freq: 700, to: 1050, dur: 0.06, vol: 0.07 });
    sfxTone({ t: t + 0.05, wave: 'triangle', freq: 1400, dur: 0.05, vol: 0.03 });
  };

  SFX.uiBack = function (t) {
    sfxTone({ t: t, wave: 'pulse', duty: 0.25, freq: 700, to: 420, dur: 0.09, vol: 0.07 });
  };

  function sfx(name) {
    if (!ctx || !name) return false;
    var fn = SFX[name];
    if (!fn) return false;
    if (muted) return false; // тишина, но и узлы не плодим
    try {
      fn(ctx.currentTime + 0.004);
      return true;
    } catch (e) {
      return false;
    }
  }

  /* ==========================================================================
     7. ПУБЛИЧНЫЙ API
     ========================================================================== */

  function setMuted(b) {
    muted = !!b;
    if (ctx) applyMasterGain(ctx.currentTime);
    return muted;
  }

  function toggleMuted() {
    return setMuted(!muted);
  }

  function getMuted() {
    return muted;
  }

  function setVolume(v) {
    if (typeof v !== 'number' || !isFinite(v)) return volume;
    v = Math.max(0, Math.min(1, v));
    volume = v;
    if (ctx && !muted) applyMasterGain(ctx.currentTime);
    return volume;
  }

  function getVolume() {
    return volume;
  }

  // Рендер трека в OfflineAudioContext (для превью/WAV/проверки клиппинга).
  // Временно подменяет ctx и шины модуля, синхронно планирует весь трек и
  // возвращает Promise<AudioBuffer>. Не влияет на живое воспроизведение.
  function renderOffline(id, seconds) {
    var tr = getTrack(id);
    if (!tr) return null;
    var OAC = window.OfflineAudioContext || window.webkitOfflineAudioContext;
    if (!OAC) return null;
    var rate = 44100;
    var full = tr.steps * tr.stepDur;
    var sec = (seconds === undefined || seconds === null) ? full : seconds;
    sec = Math.max(0.5, Math.min(60, sec));
    var off;
    try {
      off = new OAC(2, Math.ceil(sec * rate), rate);
    } catch (e) {
      return null;
    }
    var saved = {
      ctx: ctx, master: master, musicBus: musicBus, sfxBus: sfxBus,
      noiseBuffer: noiseBuffer, waveCache: waveCache
    };
    try {
      ctx = off;
      master = off.createGain();
      var comp = off.createDynamicsCompressor();
      configureCompressor(comp);
      master.connect(comp);
      var offLimiter = null;
      if (typeof off.createWaveShaper === 'function') {
        try {
          offLimiter = off.createWaveShaper();
          offLimiter.curve = makeLimiterCurve();
          try { offLimiter.oversample = '2x'; } catch (e) { /* Safari */ }
          comp.connect(offLimiter);
          offLimiter.connect(off.destination);
        } catch (e) {
          offLimiter = null;
        }
      }
      if (!offLimiter) comp.connect(off.destination);
      musicBus = off.createGain();
      musicBus.gain.value = 1;
      musicBus.connect(master);
      sfxBus = off.createGain();
      sfxBus.gain.value = 0;
      sfxBus.connect(master);
      noiseBuffer = makeNoiseBuffer();
      waveCache = {};
      var bus = off.createGain();
      bus.gain.value = tr.def.trim === undefined ? 1 : tr.def.trim;
      bus.connect(musicBus);
      var m = { id: id, tr: tr, bus: bus, step: 0, nextTime: 0 };
      var n = Math.ceil(sec / tr.stepDur) + 1;
      for (var s = 0; s < n; s++) {
        try { scheduleStep(m, s % tr.steps, s * tr.stepDur); } catch (e) { /* пропуск битого события */ }
      }
      return off.startRendering();
    } catch (e) {
      return null;
    } finally {
      ctx = saved.ctx;
      master = saved.master;
      musicBus = saved.musicBus;
      sfxBus = saved.sfxBus;
      noiseBuffer = saved.noiseBuffer;
      waveCache = saved.waveCache;
    }
  }

  /* --- внутренняя диагностика для тестов/QA (не публичный контракт) --- */
  function validateTracks() {
    var ids = ['title', 'game0', 'game1', 'game2', 'ending'];
    var expected = { title: 90, game0: 132, game1: 140, game2: 120, ending: 100 };
    var out = { errors: [], tracks: [] };
    for (var i = 0; i < ids.length; i++) {
      var id = ids[i];
      var tr = getTrack(id);
      if (!tr) {
        out.errors.push(id + ': не скомпилировался');
        continue;
      }
      if (tr.bpm !== expected[id]) out.errors.push(id + ': BPM ' + tr.bpm + ', ожидалось ' + expected[id]);
      if (tr.bars !== 8 && tr.bars !== 16) out.errors.push(id + ': тактов ' + tr.bars);
      out.tracks.push({
        id: tr.id, bpm: tr.bpm, bars: tr.bars, steps: tr.steps,
        noteCount: tr.meta.noteCount, drumEvents: tr.meta.drumEvents,
        minMidi: tr.meta.minMidi, maxMidi: tr.meta.maxMidi,
        hasPad: tr.meta.hasPad, hasWind: tr.meta.hasWind, drums: tr.meta.drums
      });
    }
    return out;
  }

  LV_audio_init();

  function LV_audio_init() {
    window.LV = window.LV || {};
    window.LV.audio = {
      // контракт §6
      unlock: unlock,
      isReady: isReady,
      playMusic: playMusic,
      stopMusic: stopMusic,
      pauseMusic: pauseMusic,
      resumeMusic: resumeMusic,
      sfx: sfx,
      setMuted: setMuted,
      toggleMuted: toggleMuted,
      getMuted: getMuted,
      setVolume: setVolume,

      // безопасные дополнения
      getVolume: getVolume,
      getCurrentMusic: getCurrentMusic,

      // внутреннее (тесты/QA)
      _debug: {
        getContextState: function () { return ctx ? ctx.state : null; },
        getMusicId: function () { return music ? music.id : null; },
        getMusicStep: function () { return music ? music.step : -1; },
        getMusicBusGain: function () { return musicBus ? musicBus.gain.value : null; },
        getMasterGain: function () { return master ? master.gain.value : null; },
        isSchedulerRunning: function () { return schedulerTimer !== null; },
        getSchedulerErrors: function () { return schedulerErrors; },
        getCompileErrors: function () { return compileErrors.slice(); },
        getFadeLog: function () { return fadeLog.slice(); },
        getSfxNames: function () {
          var names = [];
          for (var k in SFX) if (Object.prototype.hasOwnProperty.call(SFX, k)) names.push(k);
          names.sort();
          return names;
        },
        getTrackIds: function () {
          var ids = [];
          for (var k in TRACKS) if (Object.prototype.hasOwnProperty.call(TRACKS, k)) ids.push(k);
          return ids;
        },
        validateTracks: validateTracks,
        renderOffline: function (id, seconds) {
          try { return renderOffline(id, seconds); } catch (e) { return null; }
        },
        tickNow: function () {
          if (!ctx || !music) return false;
          try {
            scheduleAhead(music);
            return true;
          } catch (e) {
            schedulerErrors++;
            return false;
          }
        }
      }
    };
  }
})();

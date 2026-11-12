/* ============================================================
   ПРОРЫВ HTML5 — 8-битный звуковой движок (WebAudio, без сэмплов)
   API: docs/CONTRACT.md §2, музыка: docs/MUSIC.md.

   4 канала, как на NES/ZX:
     lead  — pulse 1 (мелодия), duty + вибрато;
     harm  — pulse 2 (гармония/арпеджио), другой duty;
     bass  — triangle (бас);
     drums — noise (ударные/перкуссия).

   Секвенсор: setInterval 25 мс, горизонт 0.12 с, время берётся из
   AudioContext.currentTime; шаг = 1/16 (stepsPerBeat = 4), луп бесшовный.

   Порядок в файле:
     0. константы и утилиты;
     1. теория нот + ДАННЫЕ ТРЕКОВ (правится композитором, без движка);
     2. компиляция данных в события;
     3. граф WebAudio;
     4. синтез голосов (pulse / triangle / noise);
     5. секвенсор с lookahead + кроссфейд;
     6. SFX;
     7. публичный API.

   Нотация паттернов (16 шагов = 1 такт 4/4):
     '.'      — пауза;
     '-'      — продление предыдущей ноты;
     '|'      — визуальный разделитель (на музыку не влияет);
     'A4'     — нота (доступны # и b: C#5, Bb3);
     '!A4'    — акцент (громче);
     'A4~'    — вибрато на ноте;
     '>A4'    — портаменто: слайд из предыдущей высоты канала;
     'A4>C5'  — глиссандо: непрерывный слайд A4 -> C5 за длительность ноты;
     барабаны: K/k kick, S/s snare, H/h hat, O open hat, C crash, T tom
               (строчная буква — тише).
   ============================================================ */
(function () {
  'use strict';

  /* ============================================================
     0. КОНСТАНТЫ И УТИЛИТЫ
     ============================================================ */

  const AC = (typeof window !== 'undefined') ? (window.AudioContext || window.webkitAudioContext) : null;
  const DEBUG = (typeof window !== 'undefined') && window.__EX_AUDIO_DEBUG__ === true;

  const LOOKAHEAD_MS = 25;        // период планировщика
  const SCHEDULE_AHEAD = 0.12;    // на сколько секунд вперёд планируем
  const CROSSFADE = 0.4;          // кроссфейд между треками, секунды

  const MASTER_LEVEL = 0.9;       // максимум общей громкости
  const MUSIC_LEVEL = 0.32;       // музыка тише эффектов, чтобы не перекрывать
  const SFX_LEVEL = 1.0;
  const DUCK_FACTOR = 0.25;       // duck(true) — музыка до ~25% громкости

  const MAX_VOICES = 24;          // суммарный лимит одновременных голосов
  const MAX_SFX_PER_ID = 6;       // лимит голосов на один звуковой эффект

  const STEPS_PER_BEAT = 4;       // шаг секвенсора = 1/16

  function clamp(v, lo, hi) {
    if (v !== v) return lo;
    return v < lo ? lo : (v > hi ? hi : v);
  }

  /* ============================================================
     1. ТЕОРИЯ НОТ + ДАННЫЕ ТРЕКОВ
     Ниже до [MUSIC-DATA-END] — только данные и чистые формулы,
     без WebAudio: этот блок можно проверять офлайн
     (exolon/tmp/validate-music.mjs).
     ============================================================ */

  /* [MUSIC-DATA-BEGIN] */

  const NOTE_BASE = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
  const SHARP_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
  // префиксы (! >) + нота + необязательное глиссандо (>нота) + необязательное вибрато (~)
  const NOTE_RE = /^([!>]*)([A-G])([#b]?)(\d)(?:>([A-G])([#b]?)(\d))?(~?)$/;

  function midiOf(letter, accidental, octave) {
    let pc = NOTE_BASE[letter];
    if (accidental === '#') pc += 1;
    else if (accidental === 'b') pc -= 1;
    return (parseInt(octave, 10) + 1) * 12 + pc;
  }

  function midiName(midi) {
    const pc = ((midi % 12) + 12) % 12;
    return SHARP_NAMES[pc] + (Math.floor(midi / 12) - 1);
  }

  // Транспонирование паттерна: '-'/'.'/'|' и барабанные буквы не трогаем.
  function transposePattern(pattern, semitones) {
    if (!semitones) return pattern;
    const tokens = pattern.split(/\s+/);
    for (let i = 0; i < tokens.length; i++) {
      const m = NOTE_RE.exec(tokens[i]);
      if (!m) continue;
      let out = m[1] + midiName(midiOf(m[2], m[3], m[4]) + semitones);
      if (m[5]) out += '>' + midiName(midiOf(m[5], m[6], m[7]) + semitones);
      tokens[i] = out + m[8];
    }
    return tokens.join(' ');
  }

  // Копия канала с выбранными тактами (indices) и необязательным транспонированием.
  function variantChannel(channel, indices, semitones) {
    const out = {
      gain: channel.gain,
      duty: channel.duty,
      vibrato: channel.vibrato,
      patterns: {},
      order: indices ? indices.map(function (i) { return channel.order[i]; }) : channel.order.slice()
    };
    const names = Object.keys(channel.patterns);
    for (let i = 0; i < names.length; i++) {
      const src = channel.patterns[names[i]];
      out.patterns[names[i]] = semitones ? transposePattern(src, semitones) : src;
    }
    return out;
  }

  /* ---------- Барабанные рисунки (16 шагов = такт) ---------- */

  const DRUMS_BASIC = {
    Db:     'K . H . | S . H . | K . H . | S . H H',
    Db2:    'K . H . | S . H . | K . H . | S . h H',
    Dfill:  'K . H . | S . H . | K . H . | S . S S',
    Dfill2: 'K . H . | S . H . | K . S . | T . T T',
    Dbuild: 'K . H h | S . H h | K . K h | S . S S'
  };

  /* ============================================================
     ТРЕК 'GAME' — основной боевой трек
     150 BPM, ля минор (с дорийской G# в E7), 32 такта = 51.2 c.
     Форма: A (1-8) — B (9-16) — A' (17-24) — C (25-32).
     ============================================================ */

  const GAME_LEAD = {
    gain: 0.30,
    duty: 0.25,
    vibrato: { rate: 5.4, depth: 13, delay: 0.14 },
    patterns: {
      // A: зацепка «вопрос-ответ» по тонам Am / F / G
      gL1:  'A4 . C5 . | E5 - D5 - | C5 - B4 - | A4 - - .',
      gL2:  'A4 . C5 . | E5 - A5 - | G5 - E5 - | D5 - C5 .',
      gL3:  'A4 . C5 . | F5 - A5 - | G5 - F5 - | C5 - - .',
      gL4:  'G4 . B4 . | D5 - G5 - | F5 - D5 - | B4 - - .',
      gL6:  'C5 - B4 - | A4 - E5 - | D5 - C5 - | B4 - - .',
      gL7:  'C5 - D5 - | F5 - A5 - | G5 - F5 - | D5 - C5 -',
      gL8:  'E5 . B4 . | G#4 - B4 - | D5 - E5 - | B4 - - .',
      // B: Dm -> Am -> F -> G -> E7, ответная фраза
      gL9:  '>D5 . F5 . | A5 - G5 - | F5 - E5 - | D5 - - .',
      gL10: 'F5 - A5 - | D5 - A4 - | D5 - F5 - | D5 - - -',
      gL11: 'E5 . A5 . | C5 - B4 - | A4 - E4 - | A4 - - .',
      gL12: 'C5 - B4 - | A4 - E4 - | A4 - C5 - | B4 - - .',
      gL13: 'A4 . C5 . | F5 - A5 - | G5 - F5 - | C5 - - .',
      gL14: 'B4 . D5 . | G5 - F5 - | D5 - B4 - | G4 - - .',
      gL15: 'E5 - G#4 - | B4 - E5 - | D5 - B4 - | G#4 - - .',
      gL16: 'B4 . D5 . | E5 - G#5 - | E5 - D5 - | B4 - - .',
      gL19: 'C5 - B4 - | A4 - E5 - | D5 - E5 - | A4 - - .',
      gL24: 'E5 . B4 . | G#4 - B4 - | D5 - B4>G#5 - | E5 - - .',
      // C: гимновая кульминация
      gL25: '>F5 - - - | A5 - - - | G5 - F5 - | C5 - - .',
      gL26: 'G5 - - - | D5 - - - | B4 - D5 - | G5 - - .',
      gL27: 'E5 - - - | A5 - - - | G5 - E5 - | C5 - - .',
      gL28: 'A5 - G5 - | E5 - C5 - | D5 - E5 - | A4 - - .',
      gL29: 'F5 - - - | A5 - - - | G5 - F5 - | C5 - - .',
      gL30: 'G5 - F5 - | D5 - B4 - | D5 - G5 - | B4 - - .',
      gL31: 'E5 - G#4 - | B4 - E5 - | B4>G#5 - E5 - | D5 - - .',
      gL32: 'A4 - - - | E5 - - - | A5~ - - - | - - - -'
    },
    order: [
      'gL1', 'gL2', 'gL3', 'gL4', 'gL1', 'gL6', 'gL7', 'gL8',
      'gL9', 'gL10', 'gL11', 'gL12', 'gL13', 'gL14', 'gL15', 'gL16',
      'gL1', 'gL2', 'gL3', 'gL4', 'gL1', 'gL19', 'gL7', 'gL24',
      'gL25', 'gL26', 'gL27', 'gL28', 'gL29', 'gL30', 'gL31', 'gL32'
    ]
  };

  const GAME_HARM = {
    gain: 0.12,
    duty: 0.125,
    patterns: {
      hAm:  'A3 C4 E4 A4 | C5 A4 E4 A3 | A3 C4 E4 A4 | C5 A4 E4 C4',
      hAm2: 'E4 A4 A4 E4 | E4 C4 A3 C4 | E4 A4 A4 E5 | A4 A4 E4 C4',
      hF:   'F3 A3 C4 F4 | A4 F4 C4 A3 | F3 A3 C4 F4 | A4 C5 A4 F4',
      hG:   'G3 B3 D4 G4 | B4 G4 D4 B3 | G3 B3 D4 G4 | B4 D5 B4 G4',
      hE:   'E3 G#3 B3 E4 | G#4 E4 B3 G#3 | E3 G#3 B3 E4 | G#4 B4 G#4 E4',
      hDm:  'D3 F3 A3 D4 | F4 D4 A3 F3 | D3 F3 A3 D4 | F4 A4 F4 D4'
    },
    order: [
      'hAm', 'hAm2', 'hF', 'hG',
      'hAm', 'hAm2', 'hF', 'hE',
      'hDm', 'hDm', 'hAm', 'hAm2',
      'hF', 'hG', 'hE', 'hE',
      'hAm', 'hAm2', 'hF', 'hG',
      'hAm', 'hAm2', 'hF', 'hE',
      'hF', 'hG', 'hAm', 'hAm2',
      'hF', 'hG', 'hE', 'hAm'
    ]
  };

  const GAME_BASS = {
    gain: 0.55,
    patterns: {
      bAm:    'A2 - A3 - | A2 - A3 - | A2 - A3 - | A2 - A3 -',
      bF:     'F2 - F3 - | F2 - F3 - | F2 - F3 - | F2 - F3 -',
      bG:     'G2 - G3 - | G2 - G3 - | G2 - G3 - | G2 - G3 -',
      bE:     'E2 - E3 - | E2 - E3 - | E2 - E3 - | E2 - E3 -',
      bDm:    'D2 - D3 - | D2 - D3 - | D2 - D3 - | D2 - D3 -',
      // подъём в конце 8-тактового блока: E -> G -> B
      bEfill: 'E2 - E3 - | E2 - E3 - | B2 - B3 - | D3 - B2 -',
      // разрешение в Am на стыке лупа: A -> E -> C -> B -> A
      bAfill: 'A2 - A3 - | A2 - E3 - | A2 - A3 - | C3 - E3 -'
    },
    order: [
      'bAm', 'bAm', 'bF', 'bG',
      'bAm', 'bAm', 'bF', 'bEfill',
      'bDm', 'bDm', 'bAm', 'bAm',
      'bF', 'bG', 'bE', 'bEfill',
      'bAm', 'bAm', 'bF', 'bG',
      'bAm', 'bAm', 'bF', 'bEfill',
      'bF', 'bG', 'bAm', 'bAm',
      'bF', 'bG', 'bE', 'bAfill'
    ]
  };

  const GAME_DRUMS = {
    gain: 0.32,
    patterns: DRUMS_BASIC,
    order: [
      'Db', 'Db', 'Db', 'Dfill',
      'Db', 'Db2', 'Dbuild', 'Dfill2',
      'Db', 'Db', 'Db', 'Dfill',
      'Db', 'Db2', 'Dbuild', 'Dfill2',
      'Db', 'Db', 'Db', 'Dfill',
      'Db', 'Db2', 'Dbuild', 'Dfill2',
      'Db', 'Db', 'Db', 'Dfill',
      'Db', 'Db2', 'Dbuild', 'Dfill2'
    ]
  };

  /* ============================================================
     ТРЕК 'EXO' — тот же материал, но агрессивнее
     156 BPM: мелодия и бас те же, гармония на октаву выше,
     хэты 16-ми, больше томов. Звучит при экзоскелете.
     ============================================================ */

  const EXO_HARM = variantChannel(GAME_HARM, null, 12);
  EXO_HARM.gain = 0.10;

  const EXO_DRUMS = {
    gain: 0.33,
    patterns: Object.assign({}, DRUMS_BASIC, {
      e1: 'K H h H | S H h H | K H h H | S H h O',
      e2: 'K H h H | S H h H | K H h H | S . S h',
      ef: 'K H h H | S H h H | K S h H | T . T T',
      eb: 'K H h H | S H h H | K H K H | S S S S'
    }),
    order: [
      'e1', 'e1', 'e1', 'ef', 'e1', 'e2', 'eb', 'ef',
      'e1', 'e1', 'e1', 'ef', 'e1', 'e2', 'eb', 'ef',
      'e1', 'e1', 'e1', 'ef', 'e1', 'e2', 'eb', 'ef',
      'e1', 'e1', 'e1', 'ef', 'e1', 'e2', 'eb', 'ef'
    ]
  };

  /* ============================================================
     ТРЕК 'FINAL' — финальный сектор, 160 BPM, ре минор
     Тот же тематический материал, транспонированный A-moll -> D-moll
     (мелодия/гармония -7 полутонов, бас +5 — та же гармония, ниже),
     порядок тактов B-C-A, плотные барабаны.
     ============================================================ */

  const FINAL_BARS = [
    0, 1, 2, 3, 4, 5, 6, 7,       // A-секция: главный мотив в Dm
    8, 9, 10, 11, 12, 13, 14, 15, // B-секция: Gm/Dm/Bb/C -> A7
    24, 25, 26, 27, 28, 29, 30, 31 // C-секция: кульминация, упирается в Dm
  ];

  const FINAL_DRUMS = {
    gain: 0.34,
    patterns: Object.assign({}, DRUMS_BASIC, {
      F1: 'K H h H | S H h H | K H h H | S H h C',
      F2: 'K H h H | S H h H | K H h H | S . S h',
      Ff: 'K H h H | S H h H | K S h H | T . T T',
      Fb: 'K H h H | S H h H | K K h H | S S S S'
    }),
    order: [
      'F1', 'F1', 'F2', 'Ff', 'F1', 'F2', 'Fb', 'Ff',
      'F1', 'F1', 'F2', 'Ff', 'F1', 'F2', 'Fb', 'Ff',
      'F1', 'F2', 'F1', 'Ff', 'F1', 'F2', 'Fb', 'Ff'
    ]
  };

  /* ============================================================
     ТРЕК 'TITLE' — титульный экран, 132 BPM, ля минор, 16 тактов
     Вступление (1-4): восходящие арпеджио, редкие барабаны.
     Тема (5-12): героическая мелодия, полная ритм-секция.
     Кода (13-16): вариация и возврат к арпеджио.
     ============================================================ */

  const TITLE_LEAD = {
    gain: 0.30,
    duty: 0.25,
    vibrato: { rate: 5.0, depth: 11, delay: 0.16 },
    patterns: {
      tI1: 'A4 C5 E5 A5 | E5 C5 A4 C5 | E5 A5 E5 C5 | A4 C5 E5 A5',
      tI2: 'F4 A4 C5 F5 | A5 F5 C5 A4 | F4 A4 C5 F5 | A5 G5 F5 C5',
      tI3: 'G4 B4 D5 G5 | D5 B4 G4 B4 | D5 G5 D5 B4 | G4 B4 D5 G5',
      tI4: 'A4 C5 E5 A5 | C6 A5 E5 C5 | A4 E5 A5 C6 | E5 C5 C5>A4 -',
      tT5:  'E5 - - A5 | - - E5 - | D5 - C5 - | A4 - - -',
      tT6:  'C5 - - E5 | - - A4 - | B4 - C5 - | D5 - - -',
      tT7:  'F5 - - C5 | - - A4 - | C5 - F4 - | A4 - - -',
      tT8:  'G5 - - D5 | - - B4 - | D5 - G4 - | B4 - - -',
      tT9:  'A5 - - E5 | - - A4 - | C5 - B4 - | A4 - - -',
      tT10: 'E5 - G5 - | >A5~ - - - | G5 - E5 - | D5 - - -',
      tT11: 'F5 - A5 - | G5 - F5 - | C5 - A4 - | F4 - - -',
      tT12: 'E5 - G#4 - | B4 - E5 - | D5 - B4 - | G#4 - - -',
      tT13: 'A4 . C5 . | E5 - D5 - | C5 - B4 - | A4 - - .',
      tT14: 'F4 . A4 . | C5 - F5 - | G5 - F5 - | C5 - - .',
      tT15: 'G4 . B4 . | D5 - G5 - | F5 - D5 - | B4 - - .',
      tT16: 'E5 . B4 . | G#4 - B4 - | D5 - E5 - | B4 - - .'
    },
    order: [
      'tI1', 'tI2', 'tI3', 'tI4',
      'tT5', 'tT6', 'tT7', 'tT8', 'tT9', 'tT10', 'tT11', 'tT12',
      'tT13', 'tT14', 'tT15', 'tT16'
    ]
  };

  const TITLE_HARM = {
    gain: 0.11,
    duty: 0.125,
    patterns: Object.assign({ rRest: '. . . . | . . . . | . . . . | . . . .' }, GAME_HARM.patterns),
    order: [
      'rRest', 'rRest', 'rRest', 'rRest',
      'hAm', 'hAm2', 'hF', 'hG', 'hAm', 'hAm2', 'hF', 'hE',
      'hAm', 'hF', 'hG', 'hE'
    ]
  };

  const TITLE_BASS = {
    gain: 0.55,
    patterns: {
      tBAmIn: 'A2 - - - - - - - | E3 - - - A3 - - -',
      tBFIn:  'F2 - - - - - - - | C3 - - - F3 - - -',
      tBGIn:  'G2 - - - - - - - | D3 - - - G3 - - -',
      tBAm4:  'A2 - - - E3 - - - | A3 - - - E3 - - -',
      tBAm:   'A2 - - - A3 - - - | A2 - - - E3 - - -',
      tBF:    'F2 - - - F3 - - - | F2 - - - C3 - - -',
      tBG:    'G2 - - - G3 - - - | G2 - - - D3 - - -',
      tBE:    'E2 - - - E3 - - - | E2 - - - B2 - - -'
    },
    order: [
      'tBAmIn', 'tBFIn', 'tBGIn', 'tBAm4',
      'tBAm', 'tBAm', 'tBF', 'tBG', 'tBAm', 'tBAm', 'tBF', 'tBE',
      'tBAm', 'tBF', 'tBG', 'tBE'
    ]
  };

  const TITLE_DRUMS = {
    gain: 0.30,
    patterns: Object.assign({
      tD1: 'H . . . | H . . . | H . . . | H . . .',
      tD2: 'K . . . | H . . . | K . . . | H . . .',
      tD3: 'K . . . | H . . . | K . H . | T . T T'
    }, DRUMS_BASIC),
    order: [
      'tD1', 'tD1', 'tD2', 'Dfill',
      'Db', 'Db2', 'Db', 'Dfill', 'Db', 'Db2', 'Db', 'Dfill2',
      'Db', 'Db2', 'Dbuild', 'Dfill'
    ]
  };

  /* ============================================================
     ДЖИНГЛЫ: clear (3.0 c), gameover (2.9 c), win (6.9 c).
     loop: false — играют один раз и замолкают.
     ============================================================ */

  const TRACKS = {
    title: {
      bpm: 132, loop: true,
      lead: TITLE_LEAD, harm: TITLE_HARM, bass: TITLE_BASS, drums: TITLE_DRUMS
    },
    game: {
      bpm: 150, loop: true, intensity: true,
      lead: GAME_LEAD, harm: GAME_HARM, bass: GAME_BASS, drums: GAME_DRUMS
    },
    exo: {
      bpm: 156, loop: true,
      lead: GAME_LEAD, harm: EXO_HARM, bass: GAME_BASS, drums: EXO_DRUMS
    },
    final: {
      bpm: 160, loop: true,
      lead: variantChannel(GAME_LEAD, FINAL_BARS, -7),
      harm: variantChannel(GAME_HARM, FINAL_BARS, -7),
      bass: variantChannel(GAME_BASS, FINAL_BARS, 5),
      drums: FINAL_DRUMS
    },

    /* --- победный джингл: C-dur, восходящая фраза, 160 BPM, 2 такта --- */
    clear: {
      bpm: 160, loop: false,
      lead: {
        gain: 0.30, duty: 0.25, vibrato: { rate: 6.0, depth: 10, delay: 0.1 },
        patterns: {
          cL1: 'C5 . E5 . | G5 . C6 . | G5 . E5 . | G5 - - -',
          cL2: 'E5 . G5 . | C6 . G5 . | E5 - G5 - | C6~ - - -'
        },
        order: ['cL1', 'cL2']
      },
      harm: {
        gain: 0.13, duty: 0.125,
        patterns: {
          cH1: 'C4 E4 G4 C5 | E5 C5 G4 E4 | C4 E4 G4 C5 | E5 G5 C6 G5',
          cH2: 'C4 E4 G4 C5 | E5 G5 C6 G5 | E5 C5 G4 E4 | C4 - - -'
        },
        order: ['cH1', 'cH2']
      },
      bass: {
        gain: 0.55,
        patterns: {
          cB1: 'C3 - - - G3 - - - | C3 - - - G2 - - -',
          cB2: 'C3 - - - E3 - - - | G3 - - - C4 - - -'
        },
        order: ['cB1', 'cB2']
      },
      drums: {
        gain: 0.30,
        patterns: {
          cD1: 'C K . H | K . H . | C K . H | K . S S',
          cD2: 'K . H . | S . H . | K . H . | S S S S'
        },
        order: ['cD1', 'cD2']
      }
    },

    /* --- проигрыш: d-moll, нисходящая фраза, 165 BPM, 2 такта --- */
    gameover: {
      bpm: 165, loop: false,
      lead: {
        gain: 0.30, duty: 0.5, vibrato: { rate: 4.5, depth: 16, delay: 0.12 },
        patterns: {
          oL1: 'D5 - - - | C5 - A4 - | F4 - D4 - | A3 - - -',
          oL2: 'D4 - - - | A4 - - - | F4 - - - | D4 - - -'
        },
        order: ['oL1', 'oL2']
      },
      harm: {
        gain: 0.12, duty: 0.125,
        patterns: {
          oH1: 'D3 - - - | A3 - - - | F3 - - - | A3 - - -',
          oH2: 'D3 - - - | A3 - - - | F3 - - - | D3 - - -'
        },
        order: ['oH1', 'oH2']
      },
      bass: {
        gain: 0.55,
        patterns: {
          oB1: 'D2 - - - D3 - - - | D2 - - - A2 - - -',
          oB2: 'D2 - - - F2 - - - | A2 - - - D3 - - -'
        },
        order: ['oB1', 'oB2']
      },
      drums: {
        gain: 0.28,
        patterns: {
          oD1: 'K . . . | T . . . | K . . . | S . . .',
          oD2: 'K . . . | S . . . | K . . . | S S S S'
        },
        order: ['oD1', 'oD2']
      }
    },

    /* --- финальный триумф: C-dur, фанфара, 140 BPM, 4 такта (~6.9 c) --- */
    win: {
      bpm: 140, loop: false,
      lead: {
        gain: 0.30, duty: 0.25, vibrato: { rate: 5.6, depth: 12, delay: 0.14 },
        patterns: {
          wL1: 'C5 . E5 . | G5 . C6 . | G5 - E5 - | C5 - - -',
          wL2: 'F5 - - - | A5 - - - | C6 - A5 - | F5 - - -',
          wL3: 'G5 - - - | D5 - B4 - | D5 - G5 - | B4 - - -',
          wL4: 'C6~ - - - | G5 - E5 - | C5 - E5 - | G5 - - -'
        },
        order: ['wL1', 'wL2', 'wL3', 'wL4']
      },
      harm: {
        gain: 0.13, duty: 0.125,
        patterns: {
          wH1: 'C4 E4 G4 C5 | E5 C5 G4 E4 | C4 E4 G4 C5 | E5 G5 C6 G5',
          wH2: 'F4 A4 C5 F5 | A5 F5 C5 A4 | F4 A4 C5 F5 | A5 C6 A5 F5',
          wH3: 'G4 B4 D5 G5 | B4 D5 G5 B5 | D5 B4 G4 B4 | D5 G5 D5 B4',
          wH4: 'C5 E5 G5 C6 | G5 E5 C5 E5 | G5 C6 G5 E5 | C5 - - -'
        },
        order: ['wH1', 'wH2', 'wH3', 'wH4']
      },
      bass: {
        gain: 0.55,
        patterns: {
          wB1: 'C3 - - - G3 - - - | C3 - - - G2 - - -',
          wB2: 'F2 - - - C3 - - - | F2 - - - A2 - - -',
          wB3: 'G2 - - - D3 - - - | G2 - - - B2 - - -',
          wB4: 'C3 - - - E3 - - - | G3 - - - C4 - - -'
        },
        order: ['wB1', 'wB2', 'wB3', 'wB4']
      },
      drums: {
        gain: 0.32,
        patterns: {
          wD1: 'C K . H | S . H . | C K . H | S . S S',
          wD2: 'K . H . | S . H . | K . H . | S . S S',
          wD3: 'K . H . | S . H . | K . K . | S . S S',
          wD4: 'C K . . | S . . . | K . . . | S S S S'
        },
        order: ['wD1', 'wD2', 'wD3', 'wD4']
      }
    }
  };

  /* [MUSIC-DATA-END] */

  /* ============================================================
     2. КОМПИЛЯЦИЯ ТРЕКОВ: строки паттернов -> события по шагам
     ============================================================ */

  const DRUM_RE = /^[KSHOCTkshoct]$/;
  const compiledTracks = {};

  function tokensOf(pattern) {
    if (typeof pattern !== 'string') return [];
    const raw = pattern.split(/\s+/);
    const out = [];
    for (let i = 0; i < raw.length; i++) {
      if (raw[i] && raw[i] !== '|') out.push(raw[i]);
    }
    return out;
  }

  function parseNoteToken(token) {
    const m = NOTE_RE.exec(token);
    if (!m) return null;
    return {
      midi: midiOf(m[2], m[3], m[4]),
      fromPrev: m[1].indexOf('>') >= 0,
      accent: m[1].indexOf('!') >= 0,
      toMidi: m[5] ? midiOf(m[5], m[6], m[7]) : 0,
      vib: m[8] === '~'
    };
  }

  function channelLength(def) {
    if (!def || !def.patterns || !def.order) return 0;
    let total = 0;
    for (let i = 0; i < def.order.length; i++) total += tokensOf(def.patterns[def.order[i]]).length;
    return total;
  }

  function compileChannel(def, kind, totalSteps) {
    const out = {
      kind: kind,
      gain: (def && typeof def.gain === 'number') ? def.gain : 0.2,
      duty: (def && def.duty) ? def.duty : 0.25,
      vibrato: (def && def.vibrato) || null,
      byStep: new Array(totalSteps),
      count: 0
    };
    if (!def || !def.patterns || !def.order) return out;
    let step = 0;
    let last = null;
    for (let oi = 0; oi < def.order.length; oi++) {
      const tokens = tokensOf(def.patterns[def.order[oi]]);
      for (let i = 0; i < tokens.length; i++) {
        const token = tokens[i];
        const at = step + i;
        if (at >= totalSteps) continue;
        if (kind === 'drums') {
          if (DRUM_RE.test(token)) pushEvent(out, { step: at, hit: token });
        } else if (token === '-') {
          if (last) last.dur += 1;
        } else if (token === '.') {
          /* пауза: last не сбрасываем — '-' и '>' работают через паузы */
        } else {
          const note = parseNoteToken(token);
          if (!note) continue;
          last = {
            step: at, midi: note.midi, dur: 1,
            vib: note.vib, accent: note.accent,
            toMidi: note.toMidi, fromMidi: 0, prev: note.fromPrev
          };
          pushEvent(out, last);
        }
      }
      step += tokens.length;
    }

    // длительности не должны вылезать за конец лупа
    const flat = [];
    for (let s = 0; s < totalSteps; s++) {
      const list = out.byStep[s];
      if (!list) continue;
      for (let j = 0; j < list.length; j++) {
        const ev = list[j];
        if (ev.dur > totalSteps - ev.step) ev.dur = totalSteps - ev.step;
        if (ev.dur < 1) ev.dur = 1;
        flat.push(ev);
      }
    }

    // портаменто: стартуем из высоты предыдущего события канала (с учётом лупа)
    if (flat.length > 1) {
      for (let i = 0; i < flat.length; i++) {
        if (flat[i].prev) flat[i].fromMidi = flat[(i - 1 + flat.length) % flat.length].midi;
      }
    }
    return out;
  }

  function pushEvent(channel, ev) {
    let list = channel.byStep[ev.step];
    if (!list) {
      list = [];
      channel.byStep[ev.step] = list;
    }
    list.push(ev);
    channel.count++;
  }

  function compileTrack(id, def) {
    const bpm = def.bpm || 150;
    const total = channelLength(def.lead) || channelLength(def.harm) || 16;
    return {
      id: id,
      bpm: bpm,
      stepDur: 60 / bpm / STEPS_PER_BEAT,
      loop: def.loop !== false,
      intensity: !!def.intensity,
      totalSteps: total,
      bars: total / 16,
      channels: {
        lead: compileChannel(def.lead, 'lead', total),
        harm: compileChannel(def.harm, 'harm', total),
        bass: compileChannel(def.bass, 'bass', total),
        drums: compileChannel(def.drums, 'drums', total)
      }
    };
  }

  function getTrack(id) {
    if (compiledTracks[id]) return compiledTracks[id];
    const def = TRACKS[id];
    if (!def) return null;
    try {
      compiledTracks[id] = compileTrack(id, def);
    } catch (err) {
      compiledTracks[id] = null;
    }
    return compiledTracks[id];
  }

  /* ============================================================
     3. ГРАФ WEBAUDIO
     ============================================================ */

  let ctx = null;
  let master = null;
  let limiter = null;
  let musicBus = null;
  let musicFilter = null;
  let sfxBus = null;
  let noiseBuf = null;
  const waveCache = {};

  let musicOn = true;
  let sfxOn = true;
  let volume = 0.8;
  let ducked = false;
  let intensity = 0.35;

  let currentTrack = null;    // id трека (помним даже при mute)
  let currentSong = null;     // объект играющего трека
  let tickTimer = null;
  let hidden = false;

  let activeVoices = 0;
  const sfxVoices = {};       // id эффекта -> число одновременных голосов
  const stats = { notes: 0 };

  function isRunning() {
    return !!ctx && ctx.state === 'running';
  }

  function midiToFreq(midi) {
    return 440 * Math.pow(2, (midi - 69) / 12);
  }

  function filterCutoff() {
    return 4200 + intensity * 4800;   // яркость растёт с напряжением
  }

  function buildNoise() {
    const len = Math.floor(ctx.sampleRate * 1.2);
    noiseBuf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = noiseBuf.getChannelData(0);
    let seed = 0x2545f491;
    for (let i = 0; i < len; i++) {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      data[i] = seed / 2147483648 - 1;
    }
  }

  function buildGraph() {
    master = ctx.createGain();
    master.gain.value = volume * MASTER_LEVEL;

    // мягкий лимитер на мастере: защита от clipping при залпах SFX
    limiter = ctx.createDynamicsCompressor();
    limiter.threshold.value = -8;
    limiter.knee.value = 6;
    limiter.ratio.value = 12;
    limiter.attack.value = 0.003;
    limiter.release.value = 0.2;

    musicBus = ctx.createGain();
    musicBus.gain.value = musicOn ? (ducked ? MUSIC_LEVEL * DUCK_FACTOR : MUSIC_LEVEL) : 0;

    musicFilter = ctx.createBiquadFilter();
    musicFilter.type = 'lowpass';
    musicFilter.frequency.value = filterCutoff();
    musicFilter.Q.value = 0.6;

    sfxBus = ctx.createGain();
    sfxBus.gain.value = sfxOn ? SFX_LEVEL : 0;

    musicBus.connect(musicFilter);
    musicFilter.connect(master);
    sfxBus.connect(master);
    master.connect(limiter);
    limiter.connect(ctx.destination);
  }

  function init() {
    if (ctx) return true;
    if (!AC) return false;
    try {
      ctx = new AC({ latencyHint: 'interactive' });
    } catch (err) {
      try {
        ctx = new AC();
      } catch (err2) {
        ctx = null;
        return false;
      }
    }
    buildNoise();
    buildGraph();
    ctx.onstatechange = onCtxState;
    return true;
  }

  function onCtxState() {
    if (!ctx) return;
    if (ctx.state === 'running') {
      if (currentTrack && !currentSong) startTrack(currentTrack);
      else if (currentSong && !currentSong.done) {
        currentSong.nextTime = ctx.currentTime + 0.05;
        startTicker();
      }
    } else {
      stopTicker();
    }
  }

  // Импульсная волна заданной скважности (duty control через PeriodicWave).
  function pulseWave(duty) {
    const key = 'd' + duty.toFixed(3);
    if (waveCache[key]) return waveCache[key];
    const harmonics = 48;
    const real = new Float32Array(harmonics + 1);
    const imag = new Float32Array(harmonics + 1);
    for (let n = 1; n <= harmonics; n++) {
      real[n] = (2 / (n * Math.PI)) * Math.sin(Math.PI * n * duty);
    }
    const wave = ctx.createPeriodicWave(real, imag, { disableNormalization: false });
    waveCache[key] = wave;
    return wave;
  }

  /* ============================================================
     4. СИНТЕЗ ГОЛОСОВ
     ============================================================ */

  function canStartVoice(sfxId) {
    if (activeVoices >= MAX_VOICES) return false;
    if (sfxId && (sfxVoices[sfxId] || 0) >= MAX_SFX_PER_ID) return false;
    return true;
  }

  function voiceStarted(sfxId) {
    activeVoices++;
    stats.notes++;
    if (sfxId) sfxVoices[sfxId] = (sfxVoices[sfxId] || 0) + 1;
  }

  function voiceEnded(sfxId) {
    activeVoices = Math.max(0, activeVoices - 1);
    if (sfxId) sfxVoices[sfxId] = Math.max(0, (sfxVoices[sfxId] || 1) - 1);
  }

  // Универсальный тон: pulse/saw/square/triangle/sine + ADSR без щелчков,
  // вибрато, портаменто и глиссандо.
  function startTone(t, o) {
    if (!ctx || !canStartVoice(o.sfxId)) return false;
    const gate = Math.max(0.02, o.gate || o.dur || 0.1);
    const attack = Math.max(0.001, o.attack === undefined ? 0.004 : o.attack);
    const release = Math.max(0.008, o.release === undefined ? 0.03 : o.release);
    const tPeak = t + Math.min(attack, gate * 0.5);
    const tRelease = Math.max(tPeak, t + gate);
    const stopAt = tRelease + release + 0.02;
    const vol = Math.max(0.0001, o.vol || 0);

    const osc = ctx.createOscillator();
    if (o.duty) {
      try {
        osc.setPeriodicWave(pulseWave(o.duty));
      } catch (err) {
        osc.type = 'square';
      }
    } else {
      osc.type = o.type || 'square';
    }

    const f0 = Math.max(20, o.f0 || 440);
    const glideAt = t + Math.max(0.01, Math.min(o.glide || 0.06, gate * 0.6));
    if (o.fromFreq && o.fromFreq > 20) {
      osc.frequency.setValueAtTime(o.fromFreq, t);
      osc.frequency.exponentialRampToValueAtTime(f0, glideAt);
    } else {
      osc.frequency.setValueAtTime(f0, t);
    }
    if (o.f1 && o.f1 > 20) {
      osc.frequency.exponentialRampToValueAtTime(o.f1, Math.max(glideAt + 0.005, t + gate));
    }

    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(vol, tPeak);
    if (tRelease > tPeak) g.gain.setValueAtTime(vol, tRelease);
    g.gain.linearRampToValueAtTime(0, tRelease + release);

    let tail = g;
    let filt = null;
    osc.connect(g);
    if (o.filter) {
      filt = ctx.createBiquadFilter();
      filt.type = o.filter.type || 'lowpass';
      filt.Q.value = o.filter.q === undefined ? 0.8 : o.filter.q;
      filt.frequency.setValueAtTime(Math.max(30, o.filter.f0 || 2000), t);
      if (o.filter.f1) {
        filt.frequency.exponentialRampToValueAtTime(Math.max(30, o.filter.f1), t + gate);
      }
      g.connect(filt);
      tail = filt;
    }
    tail.connect(o.bus || sfxBus);

    let lfo = null;
    let lfoGain = null;
    if (o.vib && o.vib.depth > 0) {
      lfo = ctx.createOscillator();
      lfo.type = 'sine';
      lfo.frequency.value = o.vib.rate || 5.5;
      lfoGain = ctx.createGain();
      lfoGain.gain.setValueAtTime(0, t);
      lfoGain.gain.linearRampToValueAtTime(o.vib.depth, t + Math.max(0.02, o.vib.delay || 0.1));
      lfo.connect(lfoGain);
      lfoGain.connect(osc.detune);
      lfo.start(t);
      lfo.stop(stopAt);
    }

    osc.start(t);
    osc.stop(stopAt);

    voiceStarted(o.sfxId);
    osc.onended = function () {
      voiceEnded(o.sfxId);
      try { osc.disconnect(); } catch (err) {}
      try { g.disconnect(); } catch (err) {}
      if (filt) { try { filt.disconnect(); } catch (err) {} }
      if (lfo) { try { lfo.disconnect(); lfoGain.disconnect(); } catch (err) {} }
    };
    return true;
  }

  // Шумовой голос: ударные и взрывы. Буфер шума генерируется в init().
  function startNoise(t, o) {
    if (!ctx || !noiseBuf || !canStartVoice(o.sfxId)) return false;
    const dur = Math.max(0.02, o.dur || 0.1);
    const attack = Math.max(0.001, o.attack === undefined ? 0.002 : o.attack);
    const end = Math.max(t + attack + 0.005, t + dur);

    const src = ctx.createBufferSource();
    src.buffer = noiseBuf;
    src.loop = true;
    src.playbackRate.value = o.rate || 1;

    const filt = ctx.createBiquadFilter();
    filt.type = o.filter || 'lowpass';
    filt.Q.value = o.q === undefined ? 0.8 : o.q;
    filt.frequency.setValueAtTime(Math.max(30, o.f0 || 1200), t);
    if (o.f1) {
      filt.frequency.exponentialRampToValueAtTime(Math.max(30, o.f1), t + (o.sweep || dur));
    }

    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(Math.max(0.0001, o.vol || 0), t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, end);

    src.connect(filt);
    filt.connect(g);
    g.connect(o.bus || sfxBus);

    src.start(t, o.offset || 0);
    src.stop(end + 0.03);

    voiceStarted(o.sfxId);
    src.onended = function () {
      voiceEnded(o.sfxId);
      try { src.disconnect(); } catch (err) {}
      try { filt.disconnect(); } catch (err) {}
      try { g.disconnect(); } catch (err) {}
    };
    return true;
  }

  /* ---------- ударные ---------- */

  const DRUM_KIT = {
    K: { vol: 1.00, filter: 'lowpass', f0: 1000, f1: 52, q: 6.5, dur: 0.20, sweep: 0.16, rate: 0.85, attack: 0.002, offset: 0.011 },
    k: { vol: 0.55, filter: 'lowpass', f0: 900, f1: 60, q: 6.0, dur: 0.16, sweep: 0.13, rate: 0.85, attack: 0.002, offset: 0.013 },
    S: { vol: 0.85, filter: 'bandpass', f0: 2000, f1: 1500, q: 1.0, dur: 0.13, sweep: 0.10, rate: 1.0, attack: 0.001, offset: 0.211 },
    s: { vol: 0.48, filter: 'bandpass', f0: 1800, f1: 1400, q: 1.0, dur: 0.10, sweep: 0.08, rate: 1.0, attack: 0.001, offset: 0.213 },
    H: { vol: 0.55, filter: 'highpass', f0: 7200, q: 0.7, dur: 0.035, rate: 1.0, attack: 0.001, offset: 0.371 },
    h: { vol: 0.24, filter: 'highpass', f0: 7200, q: 0.7, dur: 0.030, rate: 1.0, attack: 0.001, offset: 0.373 },
    O: { vol: 0.45, filter: 'highpass', f0: 6200, q: 0.7, dur: 0.24, rate: 1.0, attack: 0.002, offset: 0.531 },
    C: { vol: 0.50, filter: 'highpass', f0: 3800, q: 0.6, dur: 0.60, rate: 1.0, attack: 0.002, offset: 0.611 },
    T: { vol: 0.85, filter: 'bandpass', f0: 260, f1: 180, q: 1.8, dur: 0.18, sweep: 0.13, rate: 0.8, attack: 0.002, offset: 0.771 }
  };

  function scheduleDrum(song, channel, ev, t) {
    const kit = DRUM_KIT[ev.hit];
    if (!kit) return;
    startNoise(t, {
      bus: song.gain,
      vol: kit.vol * channel.gain,
      filter: kit.filter, f0: kit.f0, f1: kit.f1, q: kit.q,
      dur: kit.dur, sweep: kit.sweep, rate: kit.rate,
      attack: kit.attack, offset: kit.offset
    });
  }

  function scheduleNote(song, channel, ev, t) {
    const gate = Math.max(0.035, Math.min(ev.dur * song.track.stepDur * 0.92, 1.2));
    // при высоком напряжении гармония уходит на октаву вверх — плотнее и злее
    const transpose = (channel.kind === 'harm' && song.track.intensity && song.intensity > 0.7) ? 12 : 0;
    const o = {
      bus: song.gain,
      gate: gate,
      release: channel.kind === 'bass' ? 0.05 : 0.045,
      attack: channel.kind === 'bass' ? 0.005 : 0.006,
      vol: channel.gain * (ev.accent ? 1.25 : 1),
      f0: midiToFreq(ev.midi + transpose),
      fromFreq: ev.fromMidi ? midiToFreq(ev.fromMidi + transpose) : 0,
      glide: Math.min(0.10, gate * 0.5),
      f1: ev.toMidi ? midiToFreq(ev.toMidi + transpose) : 0,
      duty: channel.kind === 'bass' ? 0 : channel.duty,
      type: channel.kind === 'bass' ? 'triangle' : 'square'
    };
    if (channel.kind === 'lead' && channel.vibrato && (ev.vib || ev.dur >= 3)) {
      o.vib = {
        rate: channel.vibrato.rate,
        depth: channel.vibrato.depth * (ev.vib ? 1.6 : 1),
        delay: channel.vibrato.delay
      };
    }
    startTone(t, o);
  }

  function scheduleStep(song, step, t) {
    const track = song.track;
    const chans = track.channels;

    const lead = chans.lead.byStep[step];
    if (lead) for (let i = 0; i < lead.length; i++) scheduleNote(song, chans.lead, lead[i], t);

    const harm = chans.harm.byStep[step];
    if (harm) for (let i = 0; i < harm.length; i++) scheduleNote(song, chans.harm, harm[i], t);

    const bass = chans.bass.byStep[step];
    if (bass) for (let i = 0; i < bass.length; i++) scheduleNote(song, chans.bass, bass[i], t);

    const drums = chans.drums.byStep[step];
    let hasHat = false;
    if (drums) {
      for (let i = 0; i < drums.length; i++) {
        const hit = drums[i].hit;
        if (hit === 'H' || hit === 'h' || hit === 'O') hasHat = true;
        scheduleDrum(song, chans.drums, drums[i], t);
      }
    }

    // слой напряжения: добавочные призрачные хэты на слабых долях
    if (track.intensity && song.intensity > 0.5 && !hasHat && (step % 2 === 1)) {
      const hat = DRUM_KIT.H;
      startNoise(t, {
        bus: song.gain,
        vol: hat.vol * chans.drums.gain * 0.45 * song.intensity,
        filter: hat.filter, f0: hat.f0, q: hat.q,
        dur: hat.dur, rate: hat.rate, attack: hat.attack, offset: hat.offset
      });
    }
  }

  /* ============================================================
     5. СЕКВЕНСОР (lookahead + кроссфейд)
     ============================================================ */

  function startTicker() {
    if (tickTimer || !ctx) return;
    tickTimer = setInterval(tick, LOOKAHEAD_MS);
    tick();
  }

  function stopTicker() {
    if (tickTimer) {
      clearInterval(tickTimer);
      tickTimer = null;
    }
  }

  function tick() {
    if (!ctx || !currentSong || currentSong.done) return;
    if (ctx.state !== 'running') return;
    const song = currentSong;
    // после паузы/зависания не выстреливаем пачкой «прошлые» ноты
    if (song.nextTime < ctx.currentTime - 0.25) song.nextTime = ctx.currentTime + 0.05;
    const horizon = ctx.currentTime + SCHEDULE_AHEAD;
    let guard = 0;
    while (song.nextTime < horizon && guard++ < 128) {
      // сбойный шаг пропускаем, но время двигаем: секвенсор не должен вставать
      try {
        scheduleStep(song, song.step, song.nextTime);
      } catch (err) {}
      song.step++;
      song.nextTime += song.track.stepDur;
      if (song.step >= song.track.totalSteps) {
        if (song.track.loop) {
          song.step = 0;
        } else {
          finishSong(song);
          return;
        }
      }
    }
  }

  function createSong(track, id, fade) {
    const now = ctx.currentTime;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(1, now + fade);
    gain.connect(musicBus);
    return {
      id: id,
      track: track,
      gain: gain,
      step: 0,
      nextTime: now + 0.06,
      done: false,
      intensity: intensity
    };
  }

  function fadeOutSong(song, fade) {
    if (!ctx || !song) return;
    const now = ctx.currentTime;
    try {
      const p = song.gain.gain;
      p.cancelScheduledValues(now);
      p.setValueAtTime(Math.max(0.0001, p.value), now);
      p.linearRampToValueAtTime(0, now + fade);
    } catch (err) {}
    setTimeout(function () {
      try { song.gain.disconnect(); } catch (err) {}
    }, Math.ceil(fade * 1000) + 250);
  }

  function startTrack(id) {
    if (!ctx || ctx.state !== 'running') return false;
    const track = getTrack(id);
    if (!track) return false;
    const old = currentSong;
    const fade = old ? CROSSFADE : 0.08;
    if (old) {
      old.done = true;
      fadeOutSong(old, CROSSFADE);
    }
    const song = createSong(track, id, fade);
    currentSong = song;
    currentTrack = id;
    startTicker();
    return true;
  }

  function finishSong(song) {
    song.done = true;
    stopTicker();
    if (currentSong === song) {
      currentSong = null;
      currentTrack = null;
    }
    // хвост последних нот доигрывает, узлы потом освобождаем
    setTimeout(function () {
      try { song.gain.disconnect(); } catch (err) {}
    }, 1500);
  }

  function stopMusic() {
    currentTrack = null;
    stopTicker();
    const song = currentSong;
    currentSong = null;
    if (song) fadeOutSong(song, 0.3);
  }

  function playMusic(id) {
    if (typeof id !== 'string' || !Object.prototype.hasOwnProperty.call(TRACKS, id)) return;
    if (currentTrack === id && currentSong && !currentSong.done) return; // тот же трек не перезапускаем
    currentTrack = id;
    if (!ctx) init();
    if (!ctx) return;
    if (ctx.state !== 'running') {
      const p = ctx.resume();
      if (p && p.then) p.then(tryStartPending).catch(function () {});
      return;
    }
    startTrack(id);
  }

  function tryStartPending() {
    if (!ctx || ctx.state !== 'running') return;
    if (currentTrack && !currentSong) startTrack(currentTrack);
  }

  /* ============================================================
     6. SFX — короткие сухие звуки, всё синтезом
     ============================================================ */

  function sfxTone(t, o) {
    o.bus = sfxBus;
    return startTone(t, o);
  }

  function sfxNoise(t, o) {
    o.bus = sfxBus;
    return startNoise(t, o);
  }

  const SFX_TABLE = {
    laser: function (t) {
      sfxTone(t, { sfxId: 'laser', duty: 0.5, f0: 1850, f1: 250, gate: 0.095, attack: 0.001, release: 0.045, vol: 0.32 });
    },
    grenade: function (t) {
      sfxTone(t, { sfxId: 'grenade', duty: 0.25, f0: 400, f1: 120, gate: 0.18, attack: 0.003, release: 0.08, vol: 0.24 });
      sfxNoise(t + 0.01, { sfxId: 'grenade', filter: 'bandpass', f0: 800, f1: 260, q: 1.2, dur: 0.16, vol: 0.14, rate: 1.3, offset: 0.13 });
    },
    explosion: function (t) {
      sfxNoise(t, { sfxId: 'explosion', filter: 'lowpass', f0: 1600, f1: 90, q: 0.8, dur: 0.42, vol: 0.40, offset: 0.19 });
      sfxTone(t, { sfxId: 'explosion', type: 'sine', f0: 110, f1: 38, gate: 0.30, attack: 0.002, release: 0.08, vol: 0.16 });
    },
    bigexpl: function (t) {
      sfxNoise(t, { sfxId: 'bigexpl', filter: 'lowpass', f0: 1100, f1: 50, q: 0.9, dur: 0.80, vol: 0.46, offset: 0.29 });
      sfxNoise(t + 0.04, { sfxId: 'bigexpl', filter: 'bandpass', f0: 300, f1: 120, q: 2.5, dur: 0.55, vol: 0.20, offset: 0.31 });
      sfxTone(t, { sfxId: 'bigexpl', type: 'sine', f0: 80, f1: 32, gate: 0.55, attack: 0.002, release: 0.12, vol: 0.16 });
    },
    hit: function (t) {
      sfxNoise(t, { sfxId: 'hit', filter: 'highpass', f0: 2600, q: 0.8, dur: 0.05, vol: 0.28, offset: 0.41 });
      sfxTone(t, { sfxId: 'hit', duty: 0.5, f0: 240, f1: 120, gate: 0.05, attack: 0.001, release: 0.03, vol: 0.20 });
    },
    death: function (t) {
      sfxTone(t, { sfxId: 'death', type: 'sawtooth', f0: 640, f1: 90, gate: 0.55, attack: 0.004, release: 0.12, vol: 0.28 });
      sfxNoise(t, { sfxId: 'death', filter: 'lowpass', f0: 900, f1: 120, dur: 0.35, vol: 0.13, offset: 0.47 });
    },
    pickup: function (t) {
      sfxTone(t, { sfxId: 'pickup', duty: 0.25, f0: midiToFreq(84), gate: 0.055, attack: 0.001, release: 0.03, vol: 0.26 });
      sfxTone(t + 0.06, { sfxId: 'pickup', duty: 0.25, f0: midiToFreq(91), gate: 0.08, attack: 0.001, release: 0.05, vol: 0.24 });
    },
    powerup: function (t) {
      const notes = [72, 76, 79, 84];
      for (let i = 0; i < notes.length; i++) {
        sfxTone(t + i * 0.055, {
          sfxId: 'powerup', duty: 0.25, f0: midiToFreq(notes[i]),
          gate: i === notes.length - 1 ? 0.14 : 0.06,
          attack: 0.001, release: 0.04, vol: 0.22
        });
      }
    },
    teleport: function (t) {
      sfxTone(t, { sfxId: 'teleport', duty: 0.125, f0: 180, f1: 2400, gate: 0.36, attack: 0.004, release: 0.10, vol: 0.26 });
      sfxNoise(t, { sfxId: 'teleport', filter: 'highpass', f0: 4000, dur: 0.30, vol: 0.09, offset: 0.53 });
    },
    jump: function (t) {
      sfxTone(t, { sfxId: 'jump', duty: 0.25, f0: 240, f1: 740, gate: 0.13, attack: 0.002, release: 0.05, vol: 0.28 });
    },
    land: function (t) {
      sfxNoise(t, { sfxId: 'land', filter: 'lowpass', f0: 600, f1: 90, dur: 0.09, vol: 0.26, offset: 0.47 });
      sfxTone(t, { sfxId: 'land', type: 'triangle', f0: 150, f1: 70, gate: 0.07, attack: 0.002, release: 0.04, vol: 0.20 });
    },
    exo: function (t) {
      for (let i = 0; i < 3; i++) {
        sfxTone(t + i * 0.06, {
          sfxId: 'exo', type: 'sawtooth', f0: 180 - i * 28, f1: 150 - i * 24,
          gate: 0.05, attack: 0.002, release: 0.02, vol: 0.13
        });
        sfxNoise(t + i * 0.06, {
          sfxId: 'exo', filter: 'bandpass', f0: 2200, q: 2.0, dur: 0.035, vol: 0.08, offset: 0.23 + i * 0.07
        });
      }
    },
    menu: function (t) {
      sfxTone(t, { sfxId: 'menu', duty: 0.5, f0: 990, gate: 0.035, attack: 0.001, release: 0.02, vol: 0.20 });
    },
    select: function (t) {
      sfxTone(t, { sfxId: 'select', duty: 0.25, f0: 660, gate: 0.04, attack: 0.001, release: 0.02, vol: 0.20 });
      sfxTone(t + 0.055, { sfxId: 'select', duty: 0.25, f0: 990, gate: 0.055, attack: 0.001, release: 0.03, vol: 0.20 });
    },
    deny: function (t) {
      sfxTone(t, { sfxId: 'deny', duty: 0.5, f0: 170, f1: 130, gate: 0.13, attack: 0.002, release: 0.03, vol: 0.22 });
      sfxTone(t + 0.09, { sfxId: 'deny', duty: 0.5, f0: 150, gate: 0.10, attack: 0.002, release: 0.03, vol: 0.18 });
    },
    alarm: function (t) {
      sfxTone(t, { sfxId: 'alarm', duty: 0.5, f0: 950, gate: 0.14, attack: 0.003, release: 0.03, vol: 0.20 });
      sfxTone(t + 0.18, { sfxId: 'alarm', duty: 0.5, f0: 700, gate: 0.14, attack: 0.003, release: 0.03, vol: 0.20 });
    },
    missile: function (t) {
      sfxTone(t, {
        sfxId: 'missile', type: 'sawtooth', f0: 950, f1: 250,
        gate: 0.30, attack: 0.004, release: 0.08, vol: 0.22,
        vib: { rate: 18, depth: 70, delay: 0.02 }
      });
      sfxNoise(t, { sfxId: 'missile', filter: 'bandpass', f0: 500, f1: 1700, q: 2.0, dur: 0.28, vol: 0.18, rate: 1.2, offset: 0.61 });
    },
    crusher: function (t) {
      sfxNoise(t, { sfxId: 'crusher', filter: 'lowpass', f0: 400, f1: 70, q: 1.2, dur: 0.50, vol: 0.38, offset: 0.71 });
      sfxTone(t, { sfxId: 'crusher', duty: 0.5, f0: 70, f1: 38, gate: 0.42, attack: 0.004, release: 0.06, vol: 0.18 });
      sfxNoise(t + 0.12, { sfxId: 'crusher', filter: 'lowpass', f0: 800, f1: 100, dur: 0.30, vol: 0.18, offset: 0.77 });
    },
    clear: function (t) {
      const notes = [72, 76, 79, 84];
      for (let i = 0; i < notes.length; i++) {
        sfxTone(t + i * 0.07, {
          sfxId: 'clear', duty: 0.25, f0: midiToFreq(notes[i]),
          gate: i === notes.length - 1 ? 0.28 : 0.07,
          attack: 0.001, release: 0.06, vol: 0.24
        });
      }
    },
    gameover: function (t) {
      const notes = [69, 67, 65, 64, 62];
      for (let i = 0; i < notes.length; i++) {
        sfxTone(t + i * 0.14, {
          sfxId: 'gameover', duty: 0.5, f0: midiToFreq(notes[i]),
          gate: i === notes.length - 1 ? 0.30 : 0.13,
          attack: 0.002, release: 0.05, vol: 0.24
        });
      }
    },
    win: function (t) {
      const notes = [72, 76, 79, 84, 79, 84, 88, 84];
      for (let i = 0; i < notes.length; i++) {
        sfxTone(t + i * 0.08, {
          sfxId: 'win', duty: 0.25, f0: midiToFreq(notes[i]),
          gate: i === notes.length - 1 ? 0.42 : 0.09,
          attack: 0.001, release: 0.08, vol: 0.22
        });
      }
    }
  };

  function sfx(id) {
    if (!sfxOn || !ctx || ctx.state !== 'running' || !noiseBuf) return;
    const fn = SFX_TABLE[id];
    if (!fn) return;
    try {
      fn(ctx.currentTime + 0.006);
    } catch (err) {
      /* звук не должен ломать игровой цикл */
    }
  }

  /* ============================================================
     7. ПУБЛИЧНЫЙ API (docs/CONTRACT.md §2)
     ============================================================ */

  function ready() {
    return !!ctx && ctx.state === 'running';
  }

  function unlock() {
    if (!ctx) init();
    if (!ctx) return false;
    const activate = function () {
      tryStartPending();
      if (currentSong && !currentSong.done) startTicker();
    };
    if (ctx.state === 'running') {
      activate();
      return true;
    }
    const p = ctx.resume();
    if (p && p.then) p.then(activate).catch(function () {});
    else activate();
    return true;
  }

  function applyMusicBus(ramp) {
    if (!ctx || !musicBus) return;
    const now = ctx.currentTime;
    const target = musicOn ? (ducked ? MUSIC_LEVEL * DUCK_FACTOR : MUSIC_LEVEL) : 0;
    try {
      const p = musicBus.gain;
      p.cancelScheduledValues(now);
      if (ramp <= 0) {
        p.setValueAtTime(target, now);
      } else {
        p.setValueAtTime(p.value, now);
        p.linearRampToValueAtTime(target, now + ramp);
      }
    } catch (err) {}
  }

  function setMusic(on) {
    musicOn = !!on;
    if (!ctx) return;
    applyMusicBus(musicOn ? 0.06 : 0);
    if (musicOn) tryStartPending();
  }

  function setSfx(on) {
    sfxOn = !!on;
    if (!ctx || !sfxBus) return;
    const now = ctx.currentTime;
    try {
      sfxBus.gain.cancelScheduledValues(now);
      sfxBus.gain.setValueAtTime(sfxOn ? SFX_LEVEL : 0, now);
    } catch (err) {}
  }

  function setVolume(v) {
    volume = clamp(v, 0, 1);
    if (!ctx || !master) return;
    const now = ctx.currentTime;
    try {
      const p = master.gain;
      p.cancelScheduledValues(now);
      p.setValueAtTime(p.value, now);
      p.linearRampToValueAtTime(volume * MASTER_LEVEL, now + 0.03);
    } catch (err) {}
  }

  function duck(on) {
    ducked = !!on;
    if (ctx) applyMusicBus(ducked ? 0.15 : 0.25);
  }

  function setIntensity(x) {
    intensity = clamp(typeof x === 'number' ? x : 0, 0, 1);
    if (currentSong) currentSong.intensity = intensity;
    if (!ctx || !musicFilter) return;
    const now = ctx.currentTime;
    try {
      const p = musicFilter.frequency;
      p.cancelScheduledValues(now);
      p.setValueAtTime(p.value, now);
      p.linearRampToValueAtTime(filterCutoff(), now + 0.3);
    } catch (err) {}
  }

  const api = {
    init: init,
    unlock: unlock,
    ready: ready,
    setMusic: setMusic,
    setSfx: setSfx,
    setVolume: setVolume,
    playMusic: playMusic,
    stopMusic: stopMusic,
    sfx: sfx,
    duck: duck,
    setIntensity: setIntensity
  };

  // boolean-геттер музыки: именно его ждёт контракт.
  Object.defineProperty(api, 'music', {
    get: function () { return musicOn; },
    enumerable: true
  });
  // SFX-состояние: `sfx` уже занят методом воспроизведения,
  // поэтому boolean-геттер эффектов доступен как sfxOn.
  Object.defineProperty(api, 'sfxOn', {
    get: function () { return sfxOn; },
    enumerable: true
  });

  if (DEBUG) {
    api._debug = function () {
      return {
        ctxState: ctx ? ctx.state : 'none',
        ready: ready(),
        track: currentTrack,
        step: currentSong ? currentSong.step : 0,
        totalSteps: currentSong ? currentSong.track.totalSteps : 0,
        scheduledNotes: stats.notes,
        voices: activeVoices,
        musicOn: musicOn,
        sfxOn: sfxOn,
        volume: volume,
        intensity: intensity,
        ducked: ducked,
        masterGain: master ? +master.gain.value.toFixed(4) : 0,
        musicBusGain: musicBus ? +musicBus.gain.value.toFixed(4) : 0,
        sfxBusGain: sfxBus ? +sfxBus.gain.value.toFixed(4) : 0,
        filterHz: musicFilter ? Math.round(musicFilter.frequency.value) : 0
      };
    };
    api._tracks = TRACKS;
  }

  window.EX_AUDIO = api;

  /* ---------- автопробуждение по первому жесту и пауза во вкладке ---------- */

  // Автопробуждение: первый жест пользователя поднимает AudioContext.
  // Вызывается заново, если после возврата во вкладку контекст не проснулся.
  function armGestureUnlock() {
    if (typeof window === 'undefined' || !window.addEventListener) return;
    const events = ['pointerdown', 'keydown', 'touchstart', 'mousedown'];
    const handler = function () {
      try { unlock(); } catch (err) {}
      for (let i = 0; i < events.length; i++) {
        window.removeEventListener(events[i], handler, true);
      }
    };
    for (let i = 0; i < events.length; i++) {
      window.addEventListener(events[i], handler, true);
    }
  }

  armGestureUnlock();

  if (typeof document !== 'undefined' && document.addEventListener) {
    document.addEventListener('visibilitychange', function () {
      if (!ctx) return;
      if (document.hidden) {
        hidden = true;
        stopTicker();
        try { ctx.suspend(); } catch (err) {}
      } else {
        hidden = false;
        const resume = function () {
          if (currentSong && !currentSong.done) {
            currentSong.nextTime = ctx.currentTime + 0.06;
            startTicker();
          }
        };
        if (ctx.state === 'suspended') {
          const p = ctx.resume();
          if (p && p.then) p.then(resume).catch(function () { armGestureUnlock(); });
          else resume();
        } else {
          resume();
        }
      }
    });
    window.addEventListener('pagehide', function () {
      hidden = true;
      stopTicker();
      try { if (ctx) ctx.suspend(); } catch (err) {}
    });
  }
})();

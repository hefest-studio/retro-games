/* ПОДГОРЬЕ · музыка: оригинальные темы студии «Гефест» для секвенсора движка (engine.js ≥ 2.1).
   Arcade.tracks.podgorye — главная тема (ля минор, «кузнечный» шаг: бочка-наковальня и звонкий хэт), звучит в Воротах.
   PODGORYE.MUSIC — по треку на зону и на босса; main.js переключает их через g.setMusic при смене зоны и в бою.
   Все мелодии — 8 тактов по 8 шагов (div 2), бас и ударные кратны мелодии. */
(function (A) {
  'use strict';
  A.tracks = A.tracks || {};
  var L = { retro: 'square', modern: 'triangle' };
  A.tracks.podgorye = {
    bpm: 112, div: 2, vol: 0.7, lead: L,
    melody: [
      'A4 . C5 E5 D5 - C5 . | B4 - G4 - A4 - - . | E5 . D5 C5 B4 - C5 D5 | E5 - - - . . . .',
      'F5 . E5 D5 C5 - B4 . | C5 - A4 - B4 - G4 . | A4 C5 E5 - D5 C5 B4 G4 | A4 - - - - - . .'
    ],
    bass: 'A2 . A2 E3 A2 . G2 . | F2 . F2 C3 F2 . E2 . | C3 . C3 G2 C3 . D3 . | E2 . E2 B2 E2 . G#2 .',
    drums: 'k . h . s . h k | k . h . s . h .'
  };
  var root = typeof window !== 'undefined' ? window : globalThis;
  var PG = root.PODGORYE = root.PODGORYE || {};
  PG.MUSIC = {
    gates: A.tracks.podgorye,
    flood: {   // ре дорийский, медленные «капли»-арпеджио
      bpm: 96, div: 2, vol: 0.65, lead: L,
      melody: [
        'D5 . A4 . F5 - E5 . | D5 - - - C5 . A4 . | B4 . D5 . G5 - F5 . | E5 - - - - . . .',
        'A5 . G5 F5 E5 - D5 . | C5 - E5 - D5 - B4 . | A4 . D5 . F5 E5 D5 C5 | D5 - - - - - . .'
      ],
      bass: 'D2 - - A2 D3 - A2 - | Bb1 - - F2 Bb2 - F2 - | G2 - - D3 G2 - D3 - | A1 - - E2 A2 - C3 -',
      drums: 'k . . h . . h . | k . . h . h . .'
    },
    ice: {     // ми минор, высокая звонкая мелодия, редкие удары
      bpm: 104, div: 2, vol: 0.62, lead: L,
      melody: [
        'E5 . B5 . G5 . F#5 . | E5 - - - D5 . B4 . | C5 . G5 . E5 . D5 . | B4 - - - - . . .',
        'A5 . G5 . F#5 . E5 . | D5 - F#5 - A5 - G5 . | E5 . B4 . C5 D5 E5 F#5 | E5 - - - - - . .'
      ],
      bass: 'E2 . . . B2 . . . | C3 . . . G2 . . . | A2 . . . E2 . . . | B1 . . . F#2 . B2 .',
      drums: 'k . . . h . . . | k . . h . . h .'
    },
    hot: {     // до фригийский, напористый
      bpm: 132, div: 2, vol: 0.7, lead: L,
      melody: [
        'C5 C5 Db5 C5 G4 . C5 . | Eb5 - Db5 - C5 - G4 . | Ab4 . C5 Eb5 F5 Eb5 Db5 C5 | Db5 - - - C5 . . .',
        'G5 . F5 Eb5 Db5 - C5 . | Eb5 - F5 - G5 - Ab5 . | G5 F5 Eb5 Db5 C5 Bb4 Ab4 G4 | C5 - - - - - . .'
      ],
      bass: 'C2 C3 C2 C3 C2 C3 Db3 C3 | Ab1 Ab2 Ab1 Ab2 Bb1 Bb2 Bb1 G2',
      drums: 'k h s h k k s h | k h s h k h s o'
    },
    gardens: { // соль лидийский, лёгкий
      bpm: 108, div: 2, vol: 0.62, lead: L,
      melody: [
        'G4 . B4 D5 C#5 - D5 . | E5 - D5 - B4 - G4 . | A4 . C#5 E5 F#5 - E5 . | D5 - - - - . . .',
        'B5 . A5 G5 F#5 - E5 . | D5 - E5 - C#5 - A4 . | B4 . D5 G5 F#5 E5 D5 C#5 | D5 - G4 - - - . .'
      ],
      bass: 'G2 . D3 . G2 . D3 . | A2 . E3 . A2 . E3 . | E2 . B2 . E2 . B2 . | D2 . A2 . D2 . F#2 .',
      drums: 'k . h h s . h . | k . h h s . h h'
    },
    halls: {   // си минор, торжественно и сумрачно
      bpm: 90, div: 2, vol: 0.62, lead: L,
      melody: [
        'B4 - - - F#5 - - - | E5 - D5 - C#5 - - . | D5 - B4 - G4 - A4 . | F#4 - - - - - . .',
        'B4 - D5 - F#5 - B5 . | A5 - G5 - F#5 - E5 . | D5 - E5 - C#5 - A#4 . | B4 - - - - - . .'
      ],
      bass: 'B1 - - - B2 - - - | G1 - - - G2 - - - | E2 - - - E3 - - - | F#2 - - - F#1 - - -',
      drums: 'k . . . s . . . | k . . . s . h .'
    },
    core: {    // фа-диез минор, пульсирующее сердце
      bpm: 120, div: 2, vol: 0.68, lead: L,
      melody: [
        'F#4 . A4 C#5 F#5 - E5 . | D5 - C#5 - B4 - A4 . | B4 . D5 F#5 G#5 - F#5 . | F5 - - - - . . .',
        'A5 . G#5 F#5 E5 - D5 . | C#5 - D5 - E5 - C#5 . | B4 . A4 G#4 A4 B4 C#5 F5 | F#5 - - - - - . .'
      ],
      bass: 'F#2 . F#2 . F#3 . F#2 . | D2 . D2 . D3 . D2 . | B1 . B1 . B2 . B1 . | C#2 . C#2 . C#3 . G#2 .',
      drums: 'k . . k s . h . | k . . k s . h h'
    },
    boss: {    // ми фригийский, упрямые повторы
      bpm: 152, div: 2, vol: 0.72, lead: L,
      melody: [
        'E5 E5 . F5 E5 . D5 E5 | B4 - C5 - B4 - A4 . | E5 E5 . G5 F5 . E5 D5 | C5 - B4 - E4 - - .',
        'A5 - G5 - F5 - E5 . | F5 - E5 - D5 - C5 . | B4 C5 D5 E5 F5 E5 D5 C5 | B4 - - - E4 . . .'
      ],
      bass: 'E2 E3 E2 E3 E2 E3 D3 B2 | C2 C3 C2 C3 B1 B2 B1 D3',
      drums: 'k h s h k k s h'
    },
    final: {   // ля гармонический минор, стремительно
      bpm: 160, div: 2, vol: 0.74, lead: L,
      melody: [
        'A4 C5 E5 A5 G#5 - E5 . | F5 - E5 - D5 - B4 . | C5 E5 A5 - B5 A5 G#5 E5 | A5 - - - E5 . . .',
        'D5 F5 A5 - G#5 F5 E5 D5 | C5 - B4 - A4 - G#4 . | A4 B4 C5 D5 E5 F5 G#5 B5 | A5 - - - - - . .'
      ],
      bass: 'A1 A2 A1 A2 F1 F2 F1 F2 | D2 D3 D2 D3 E2 E3 E2 G#2',
      drums: 'k h s h k h s s'
    }
  };
})(window.Arcade = window.Arcade || {});

/* ЦЕПЬ · музыка: оригинальные темы студии «Гефест» для секвенсора движка (engine.js ≥ 2.1).
   Arcade.tracks.tsep — тема башни: ре дорийский, «часовой» шаг баса и тиканье хэта (8 тактов мелодии на 4 такта баса).
   TSEP.MUSIC.boss — тема стража этажа: ми фригийский, упрямые повторы. TSEP.MUSIC.heart — тема Часового Сердца: си минор.
   Тема башни подключается движком сама по gameId; темы стражей main.js включает через g.setMusic. */
(function (A) {
  'use strict';
  A.tracks = A.tracks || {};
  A.tracks.tsep = {
    bpm: 138, div: 2, vol: 0.75, lead: { retro: 'square', modern: 'triangle' },
    melody: [
      'D5 . A4 D5 E5 - F5 E5 | D5 - C5 - A4 - - . | G4 . D5 G4 F5 - E5 D5 | E5 - A4 - - - . .',
      'F5 . E5 F5 G5 - A5 G5 | F5 - E5 - D5 - C5 . | B4 C5 D5 - A4 - G4 F4 | E4 - F4 - D4 - - .'
    ],
    bass: 'D3 . D3 A2 D3 . C3 A2 | G2 . G2 D3 G2 . A2 C3 | Bb2 . Bb2 F2 Bb2 . C3 D3 | A2 . A2 E2 A2 . C#3 E3',
    drums: 'k h s h k h s h | k h s h k k s o'
  };
  var root = typeof window !== 'undefined' ? window : globalThis;
  var T = root.TSEP = root.TSEP || {};
  T.MUSIC = {
    stage: A.tracks.tsep,
    boss: {
      bpm: 160, div: 2, vol: 0.75, lead: { retro: 'square', modern: 'triangle' },
      melody: [
        'E5 E5 . F5 E5 . D5 E5 | B4 - C5 - B4 - A4 . | E5 E5 . G5 F5 . E5 D5 | C5 - B4 - E4 - - .',
        'A5 - G5 - F5 - E5 . | F5 - E5 - D5 - C5 . | B4 C5 D5 E5 F5 E5 D5 C5 | B4 - - - E4 . . .'
      ],
      bass: 'E2 E3 E2 E3 E2 E3 D3 B2 | C2 C3 C2 C3 B1 B2 B1 D3',
      drums: 'k h s h k k s h'
    },
    heart: {
      bpm: 150, div: 2, vol: 0.75, lead: { retro: 'square', modern: 'triangle' },
      melody: [
        'B4 D5 F#5 - E5 D5 C#5 D5 | B4 - F#4 - B4 - - . | G5 - F#5 - E5 - D5 . | C#5 D5 E5 - F#5 - - .',
        'B5 - A5 - G5 - F#5 . | E5 - D5 - C#5 - B4 . | G4 A4 B4 C#5 D5 E5 F#5 G5 | F#5 - - - B4 . . .'
      ],
      bass: 'B1 B2 B1 B2 G1 G2 G1 G2 | E2 E3 E2 E3 F#2 F#3 F#2 A#2',
      drums: 'k h s h k h s s'
    }
  };
})(window.Arcade = window.Arcade || {});

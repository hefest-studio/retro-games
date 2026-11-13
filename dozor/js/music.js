/* ДОЗОР · музыка: оригинальная тема студии «Гефест» для секвенсора движка (engine.js ≥ 2.1).
   Характер: упругий «дозорный» марш в ре миноре — короткие фанфарные фразы, бас ходит квинтами
   (Dm → C → B♭ → A), малый барабан на сильных долях; 8 тактов мелодии на 4 такта баса.
   Подключается сама: трек кладётся в Arcade.tracks.dozor, движок берёт его по gameId. */
(function (A) {
  'use strict';
  A.tracks = A.tracks || {};
  A.tracks.dozor = {
    bpm: 144, div: 2, vol: 0.85, lead: { retro: 'square', modern: 'triangle' },
    melody: [
      'D5 . D5 F5 A5 - G5 F5 | E5 . C5 D5 E5 - - . | F5 . F5 A5 C6 - A5 G5 | A5 - - . E5 - - .',
      'D5 . D5 F5 A5 - Bb5 A5 | G5 . F5 G5 A5 - F5 . | E5 . G5 F5 E5 D5 C5 E5 | D5 - - - - . . .'
    ],
    bass: 'D2 D3 D2 D3 D2 D3 A2 C3 | C2 C3 C2 C3 G2 G3 G2 Bb2 | Bb1 Bb2 Bb1 Bb2 F2 F3 F2 A2 | A1 A2 A1 A2 E2 E3 A2 C3',
    drums: 'k . h k s . h h | k h k . s h s o'
  };
})(window.Arcade = window.Arcade || {});

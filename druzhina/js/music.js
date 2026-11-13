/* ДРУЖИНА · музыка: оригинальная походная тема студии «Гефест» для секвенсора движка (engine.js ≥ 2.1).
   Характер: тяжёлый «кузнечный» марш в ре миноре — бас ударяет квинтами, мелодия — широкие фразы
   в духе дружинной песни с подъёмом к си-бемолю и возвратом; 8 тактов мелодии на 4 такта баса.
   Подключается сама: трек кладётся в Arcade.tracks.druzhina, движок берёт его по gameId. */
(function (A) {
  'use strict';
  A.tracks = A.tracks || {};
  A.tracks.druzhina = {
    bpm: 138, div: 2, vol: 0.85, lead: { retro: 'square', modern: 'triangle' },
    melody: [
      'D5 - - A4 D5 E5 F5 . | E5 - D5 C5 D5 - A4 . | Bb4 - C5 D5 F5 - E5 D5 | E5 - - - A4 . . . |',
      'D5 - - A4 D5 E5 F5 G5 | A5 - G5 F5 E5 - D5 . | Bb5 - A5 G5 F5 - E5 C5 | D5 - - - - . . . |'
    ],
    bass: 'D2 . D3 A2 D2 . D3 A2 | Bb1 . Bb2 F2 Bb1 . Bb2 F2 | G1 . G2 D2 C2 . C3 G2 | A1 . A2 E2 A1 A2 C3 E3',
    drums: 'k . h k s . h . | k . h k s h o .'
  };
})(window.Arcade = window.Arcade || {});

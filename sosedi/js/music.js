/* ШПУЛЬКА · музыка: оригинальная тема студии «Гефест» для секвенсора движка — вальсовая «качель» (6/8) ре минор:
   мелодия кружит вокруг трёх нот и срывается вверх, бас шагает по тоникам. Ключ = gameId (sosedi). */
(function (A) {
  'use strict';
  A.tracks = A.tracks || {};
  A.tracks.sosedi = {
    bpm: 138, div: 2, vol: 0.7, lead: { retro: 'square', modern: 'triangle' },
    melody: [
      'D5 . F5 A5 . F5 | E5 . G5 A5 - - | D5 . F5 A5 . C6 | A5 - G5 F5 - - ',
      'Bb4 . D5 F5 . D5 | C5 . E5 G5 - - | A4 . C5 E5 . G5 | F5 - E5 D5 - - '
    ],
    bass: 'D2 . A2 . D3 . | A2 . E3 . A2 . | Bb2 . F3 . Bb2 . | A2 . E3 . A2 . ',
    drums: 'k . h h s . | k . h h s h'
  };
})(window.Arcade = window.Arcade || {});

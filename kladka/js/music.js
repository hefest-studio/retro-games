/* КЛАДКА · музыка: оригинальная тема студии «Гефест» для секвенсора движка (engine.js ≥ 2.1).
   Характер: бодрая «кузнечная» тема ми минор — молоточки восьмыми, бас с октавным прыжком. 8 тактов.
   Подключается сама: трек кладётся в Arcade.tracks.kladka, движок берёт его по gameId. */
(function (A) {
  'use strict';
  A.tracks = A.tracks || {};
  A.tracks.kladka = {
    bpm: 144, div: 2, vol: 0.85, lead: { retro: 'square', modern: 'triangle' },
    melody: [
      'E5 . G5 . B5 A5 G5 . | F#5 . D5 . E5 - - . | E5 . G5 . B5 . D6 C6 | B5 - A5 . G5 . F#5 .',
      'G5 . E5 . C5 . E5 G5 | A5 - G5 . F#5 . D5 . | E5 G5 B5 E6 D6 B5 A5 F#5 | E5 - - - . . B4 .'
    ],
    bass: 'E2 . E3 E2 . E2 E3 . | D2 . D3 D2 . D2 D3 . | C2 . C3 C2 . C2 C3 . | B1 . B2 B1 . D2 F#2 .',
    drums: 'k . h . s . h k | k . h . s h s o'
  };
})(window.Arcade = window.Arcade || {});

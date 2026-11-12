/* ЗАСТАВА · музыка: оригинальная тема студии «Гефест» для секвенсора движка (engine.js ≥ 2.1).
   Характер: тревожный «дозорный» марш ре минор — ровный бас четвертями, сигнальная мелодия
   с октавными окликами, во второй половине — подъём к ля. 8 тактов мелодии на 4 такта баса.
   Подключается сама: трек кладётся в Arcade.tracks.zastava, движок берёт его по gameId. */
(function (A) {
  'use strict';
  A.tracks = A.tracks || {};
  A.tracks.zastava = {
    bpm: 126, div: 2, vol: 0.8, lead: { retro: 'square', modern: 'triangle' },
    melody: [
      'D5 . . F5 E5 . D5 . | A4 - - . C5 . D5 . | F5 . E5 . D5 . C5 . | A4 - - - . . . .',
      'D5 . . F5 G5 . A5 . | C6 - A5 . G5 . F5 . | E5 . F5 G5 A5 . E5 . | D5 - - - . . A4 .'
    ],
    bass: 'D2 . D3 . D2 . D3 . | Bb1 . Bb2 . Bb1 . Bb2 . | C2 . C3 . C2 . C3 . | A1 . A2 . A1 . E2 .',
    drums: 'k . h . s . h . | k . h k s . h h'
  };
})(window.Arcade = window.Arcade || {});

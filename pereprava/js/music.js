/* ПЕРЕПРАВА · музыка: оригинальная тема студии «Гефест» для секвенсора движка (engine.js ≥ 2.1).
   Характер: бодрый «семенящий» соль мажор — прыгучая мелодия с паузами-«прыжками»,
   шагающий бас четвертями, лёгкий хэт. 8 тактов мелодии на 4 такта баса.
   Подключается сама: трек кладётся в Arcade.tracks.pereprava, движок берёт его по gameId. */
(function (A) {
  'use strict';
  A.tracks = A.tracks || {};
  A.tracks.pereprava = {
    bpm: 138, div: 2, vol: 0.8, lead: { retro: 'square', modern: 'triangle' },
    melody: [
      'G5 . B5 . D6 . B5 . | C6 . A5 . F#5 - D5 . | G5 . B5 . D6 . G6 . | E6 - D6 . B5 . . .',
      'C6 . E6 . C6 . A5 . | B5 . D6 . B5 . G5 . | A5 . F#5 . D5 . F#5 A5 | G5 - - . . . D5 .'
    ],
    bass: 'G2 . D3 . G2 . D3 . | C3 . G2 . D3 . A2 . | E2 . B2 . C3 . G2 . | D2 . A2 . D3 . F#2 .',
    drums: 'k . h . s . h h | k . h k s . h o'
  };
})(window.Arcade = window.Arcade || {});

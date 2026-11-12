/* ПУЗЫРЬ · музыка: оригинальная тема студии «Гефест» для секвенсора движка (engine.js ≥ 2.1).
   Характер: весёлая «пузырчатая» полька соль мажор — прыгающая мелодия с короткими форшлагами,
   бас «ум-па» через октаву, лёгкий хэт. 8 тактов мелодии на 4 такта баса.
   Подключается сама: трек кладётся в Arcade.tracks.puzyr, движок берёт его по gameId. */
(function (A) {
  'use strict';
  A.tracks = A.tracks || {};
  A.tracks.puzyr = {
    bpm: 144, div: 2, vol: 0.85, lead: { retro: 'square', modern: 'triangle' },
    melody: [
      'G5 . B5 D6 . B5 G5 . | A5 . C6 E6 . C6 A5 . | B5 . D6 G6 . F#6 E6 D6 | C6 - B5 . A5 - . .',
      'E5 . G5 B5 . A5 G5 . | F#5 . A5 C6 . B5 A5 . | G5 B5 D6 B5 C6 A5 F#5 A5 | G5 - D5 . G5 - . .'
    ],
    bass: 'G2 . D3 . G2 . D3 . | A2 . E3 . D2 . F#2 . | C3 . G2 . E2 . B2 . | D2 . A2 . D3 . F#2 .',
    drums: 'k . h . s . h . | k . h k s . h h'
  };
})(window.Arcade = window.Arcade || {});

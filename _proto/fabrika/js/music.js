/* ЛЕНТОВОД · js/music.js — оригинальная тема студии «Гефест» для секвенсора движка (engine.js ≥ 2.1).
   Характер: мерный ход паровой мастерской — ре дорийский, «качающийся» бас как шатун, сухие удары молота. 8 тактов.
   Подключается сама: трек кладётся в Arcade.tracks.lentovod, движок берёт его по gameId. */
(function (A) {
  'use strict';
  A.tracks = A.tracks || {};
  A.tracks.lentovod = {
    bpm: 112, div: 2, vol: 0.8, lead: { retro: 'square', modern: 'triangle' },
    melody: [
      'D5 . F5 G5 A5 - G5 F5 | E5 - C5 . D5 - . . | D5 . F5 G5 A5 - C6 A5 | B5 - A5 G5 A5 - . .',
      'F5 - E5 D5 C5 - D5 E5 | F5 . A5 . G5 - E5 . | D5 - F5 E5 D5 C5 A4 C5 | D5 - - . . . . .'
    ],
    bass: [
      'D3 . A2 . D3 . A2 . | C3 . G2 . C3 . G2 . | D3 . A2 . D3 . A2 . | G2 . D3 . A2 . E3 .',
      'Bb2 . F3 . Bb2 . F3 . | F2 . C3 . F2 . C3 . | G2 . D3 . A2 . E3 . | D3 . A2 . D3 . . .'
    ],
    drums: 'k . h . s . h k | k . h . s h s .'
  };
})(window.Arcade = window.Arcade || {});

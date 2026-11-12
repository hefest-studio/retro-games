/* ЗВЕРО-ОТРЯД · музыка: оригинальная тема студии «Гефест» для секвенсора движка (engine.js ≥ 2.1).
   Характер: весёлая «мастерская» до мажор — подпрыгивающие арпеджио, бас «прыг-скок». 8 тактов.
   Подключается сама: трек кладётся в Arcade.tracks['zvero-otryad'], движок берёт его по gameId. */
(function (A) {
  'use strict';
  A.tracks = A.tracks || {};
  A.tracks['zvero-otryad'] = {
    bpm: 144, div: 2, vol: 0.85, lead: { retro: 'square', modern: 'triangle' },
    melody: [
      'C5 . E5 G5 . E5 C5 . | D5 . F5 A5 . G5 F5 . | E5 . G5 C6 . B5 A5 G5 | A5 - G5 - E5 - . .',
      'F5 . A5 F5 E5 . G5 E5 | D5 . F5 D5 C5 . E5 C5 | B4 . D5 G5 . F5 D5 B4 | C5 - - - G4 - . .'
    ],
    bass: [
      'C3 . G2 . C3 . G2 . | D3 . A2 . D3 . A2 . | E3 . B2 . E3 . C3 . | F2 . C3 . F2 . G2 .',
      'F2 . C3 . F2 . C3 . | D2 . A2 . D2 . G2 . | G2 . D3 . G2 . B2 . | C3 . G2 . C3 . . .'
    ],
    drums: 'k h s h k k s h | k h s h k h s o'
  };
})(window.Arcade = window.Arcade || {});

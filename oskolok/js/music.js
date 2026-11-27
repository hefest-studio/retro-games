/* ОСКОЛОК · музыка: оригинальная тема студии «Гефест» для секвенсора движка (engine.js ≥ 2.1).
   Характер: тёплый, чуть озорной марш подмастерья по остывшей стекловарне — ля минор, живой бас «раз-и-два», звонкие «стеклянные» ноты
   мелодии в высоком регистре. 8 тактов мелодии на 4 такта баса. Подключается сама: трек в Arcade.tracks.oskolok (по gameId). */
(function (A) {
  'use strict';
  A.tracks = A.tracks || {};
  A.tracks.oskolok = {
    bpm: 124, div: 2, vol: 0.7, lead: { retro: 'square', modern: 'triangle' },
    melody: [
      'A4 . C5 E5 - D5 C5 . | B4 . D5 G5 - F5 E5 . | A4 . C5 E5 - A5 G5 . | E5 - D5 - C5 - - .',
      'F5 . E5 D5 - C5 D5 . | E5 . D5 C5 - B4 C5 . | D5 . F5 A5 - G5 F5 . | E5 - - - A4 - - .'
    ],
    bass: 'A2 . A2 E3 A2 . G2 E3 | F2 . F2 C3 F2 . G2 B2 | A2 . A2 E3 A2 . C3 E3 | D3 . D3 A2 E3 . E2 G#2',
    drums: 'k h . h s h . h | k h k h s h . o'
  };
})(window.Arcade = window.Arcade || {});

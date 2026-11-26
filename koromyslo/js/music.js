/* КОРОМЫСЛО · музыка: оригинальная тема студии «Гефест» для секвенсора движка (engine.js ≥ 2.1).
   Характер: неторопливый «весовой» вальсок-раскачка ля минор — мелодия ходит вверх-вниз, как стрелка весов,
   бас качается квинтой. 8 тактов мелодии на 4 такта баса. Трек кладётся в Arcade.tracks.koromyslo — движок берёт его по gameId. */
(function (A) {
  'use strict';
  A.tracks = A.tracks || {};
  A.tracks.koromyslo = {
    bpm: 104, div: 2, vol: 0.75, lead: { retro: 'square', modern: 'triangle' },
    melody: [
      'A4 . C5 E5 D5 . C5 . | B4 . G4 . A4 - - . | C5 . E5 G5 F5 . E5 . | D5 - B4 . C5 - - .',
      'E5 . A5 . G5 E5 D5 . | C5 . D5 E5 B4 - - . | A4 . C5 . B4 . G4 . | A4 - - - . . E4 .'
    ],
    bass: 'A2 . E3 . A2 . E3 . | F2 . C3 . F2 . C3 . | C3 . G2 . C3 . G2 . | E2 . B2 . E2 . G#2 .',
    drums: 'k . h . s . h h | k . h k s . h .'
  };
})(window.Arcade = window.Arcade || {});

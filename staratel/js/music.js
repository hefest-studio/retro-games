/* СТАРАТЕЛЬ · музыка: оригинальная тема студии «Гефест» для секвенсора движка (engine.js ≥ 2.1).
   Характер: шахта — размеренный ля-минор, «кирка» на малом барабане, тревожный подъём к выходу. 8 тактов.
   Подключается сама: трек кладётся в Arcade.tracks.staratel, движок берёт его по gameId. */
(function (A) {
  'use strict';
  A.tracks = A.tracks || {};
  A.tracks.staratel = {
    bpm: 124, div: 2, vol: 0.9, lead: { retro: 'square', modern: 'triangle' },
    melody: [
      'A4 . C5 E5 D5 . C5 B4 | A4 - - . E4 . A4 . | F4 . A4 C5 B4 . A4 G4 | E4 - - . . . G#4 .',
      'A4 . C5 E5 A5 . G5 E5 | F5 - E5 D5 C5 - B4 . | C5 . D5 E5 F5 E5 D5 B4 | A4 - - - . . . .'
    ],
    bass: [
      'A2 . A2 E2 A2 . A2 E2 | A2 . A2 E2 A2 . G2 . | F2 . F2 C3 F2 . F2 C3 | E2 . E2 B2 E2 . G#2 .'
    ],
    drums: 'k . h s . k h . | k . h s . h s h'
  };
})(window.Arcade = window.Arcade || {});

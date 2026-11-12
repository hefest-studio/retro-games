/* РУСЛО · музыка: оригинальная тема студии «Гефест» для секвенсора движка (engine.js ≥ 2.1).
   Характер: бреющий полёт над рекой — бодрый ре-мажор с уходом в си-минор, «мотор» в басу. 8 тактов.
   Подключается сама: трек кладётся в Arcade.tracks.ruslo, движок берёт его по gameId. */
(function (A) {
  'use strict';
  A.tracks = A.tracks || {};
  A.tracks.ruslo = {
    bpm: 150, div: 2, vol: 0.85, lead: { retro: 'square', modern: 'triangle' },
    melody: [
      'D5 - F#5 A5 - F#5 E5 D5 | E5 - G5 B5 - A5 G5 E5 | F#5 - A5 D6 - C#6 B5 A5 | B5 - - A5 G5 F#5 E5 -',
      'B4 - D5 F#5 - E5 D5 B4 | G4 - B4 D5 - E5 F#5 G5 | A5 - G5 F#5 E5 - C#5 E5 | D5 - - - A4 - D5 -'
    ],
    bass: [
      'D2 D2 D3 D2 D2 D2 D3 D2 | E2 E2 E3 E2 E2 E2 E3 E2 | F#2 F#2 F#3 F#2 D2 D2 D3 D2 | G2 G2 G3 G2 A2 A2 A3 A2',
      'B1 B1 B2 B1 B1 B1 B2 B1 | G1 G1 G2 G1 G1 G1 G2 G1 | A1 A1 A2 A1 A1 A1 A2 A1 | D2 D2 D3 D2 A1 A1 A2 A1'
    ],
    drums: 'k h s h k k s h | k h s h k h s o'
  };
})(window.Arcade = window.Arcade || {});

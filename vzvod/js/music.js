/* ВЗВОД · музыка: оригинальная тема студии «Гефест» для секвенсора движка (engine.js ≥ 2.1).
   Характер: бодрый «мастеровой» грув в ля миноре, 126 BPM — упругая мелодия с подъёмами к верхнему ля,
   бас качается квинтами A → F → C → E (с «заводной» восходящей нотой в конце такта). 8 тактов мелодии на 4 такта баса.
   Подключается сама: трек кладётся в Arcade.tracks.vzvod, движок берёт его по gameId. */
(function (A) {
  'use strict';
  A.tracks = A.tracks || {};
  A.tracks.vzvod = {
    bpm: 126, div: 2, vol: 0.75, lead: { retro: 'square', modern: 'triangle' },
    melody: [
      'A4 . C5 E5 D5 . C5 A4 | G4 . A4 C5 D5 - . . | E5 . D5 C5 D5 . E5 G5 | A5 - G5 E5 D5 - . .',
      'C5 . C5 D5 E5 . G5 E5 | D5 . C5 A4 G4 - A4 . | C5 D5 E5 . G5 . E5 D5 | E5 - - . A4 - - .'
    ],
    bass: 'A2 . A2 E2 A2 . G2 . | F2 . F2 C3 F2 . E2 . | C3 . C3 G2 C3 . D3 . | E2 . E2 B2 E2 . G#2 .',
    drums: 'k . h s k h s h | k h s . k k s o'
  };
})(window.Arcade = window.Arcade || {});

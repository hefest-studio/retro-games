/* РИКОШЕТ · музыка: оригинальная тема студии «Гефест» для секвенсора движка (engine.js ≥ 2.1).
   Характер: бодрый кузнечный ход ля минор — бас «бьёт молотом» по долям с октавным отскоком,
   мелодия из коротких звонких фраз-рикошетов, во второй половине поднимается к до и ми.
   8 тактов мелодии на 4 такта баса. Подключается сама: трек кладётся в Arcade.tracks.rikoshet, движок берёт его по gameId. */
(function (A) {
  'use strict';
  A.tracks = A.tracks || {};
  A.tracks.rikoshet = {
    bpm: 138, div: 2, vol: 0.7, lead: { retro: 'square', modern: 'triangle' },
    melody: [
      'A4 . C5 E5 A5 . E5 . | G5 - E5 . D5 C5 D5 . | F5 . E5 D5 C5 - A4 . | B4 - C5 - B4 . G4 .',
      'A4 . C5 E5 A5 . B5 . | C6 - B5 A5 G5 . E5 . | F5 E5 D5 . E5 - C5 . | A4 - - - E4 . . .'
    ],
    bass: 'A2 . A3 . A2 A2 E3 . | F2 . F3 . F2 F2 C3 . | D2 . D3 . D2 D2 A2 . | E2 . E3 . E2 G#2 B2 E3',
    drums: 'k . h k s . h . | k . h . s h k h'
  };
})(window.Arcade = window.Arcade || {});

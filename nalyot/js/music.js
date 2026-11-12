/* НАЛЁТ · музыка: оригинальная бодрая тема студии «Гефест» для секвенсора движка (engine.js ≥ 2.1).
   Характер: задорный «рабочий» марш-галоп, ми минор → соль мажор, бас прыгает октавами,
   мелодия — короткие фразы с синкопой; 8 тактов мелодии на 4 такта баса.
   Подключается сама: трек кладётся в Arcade.tracks.nalyot, движок берёт его по gameId. */
(function (A) {
  'use strict';
  A.tracks = A.tracks || {};
  A.tracks.nalyot = {
    bpm: 150, div: 2, vol: 0.85, lead: { retro: 'square', modern: 'triangle' },
    melody: [
      'E5 . E5 G5 . A5 B5 . | A5 G5 E5 - D5 - E5 . | G5 . G5 A5 . B5 D6 . | B5 - A5 - G5 - - .',
      'E5 . E5 G5 . A5 B5 . | D6 - B5 A5 G5 - A5 . | B5 . A5 G5 . F#5 G5 . | E5 - - - - . . .'
    ],
    bass: 'E2 E3 E2 E3 E2 E3 B2 D3 | C2 C3 C2 C3 C2 C3 G2 C3 | G2 G3 G2 G3 D2 D3 F#2 A2 | E2 E3 E2 E3 B1 B2 D2 B2',
    drums: 'k h s h k k s h | k h s h k h s o'
  };
})(window.Arcade = window.Arcade || {});

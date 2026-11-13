/* ТЕНЬ · музыка: оригинальная тема студии «Гефест» для секвенсора движка (engine.js ≥ 2.1).
   Характер: напряжённая погоня в ми миноре на 150 ударов — бас «крадущимися» восьмыми, мелодия с короткими
   рывками вверх и задержанными нотами, как прыжки от стены к стене. 8 тактов мелодии на 4 такта баса.
   Подключается сама: трек кладётся в Arcade.tracks.ten, движок берёт его по gameId. */
(function (A) {
  'use strict';
  A.tracks = A.tracks || {};
  A.tracks.ten = {
    bpm: 150, div: 2, vol: 0.8, lead: { retro: 'square', modern: 'triangle' },
    melody: [
      'E5 . G5 B5 A5 - G5 . | F#5 - D5 . E5 - . . | E5 . G5 B5 C6 - B5 A5 | B5 - - . F#5 - . .',
      'G5 . A5 B5 D6 - C6 . | B5 . A5 . G5 - F#5 . | E5 . F#5 G5 A5 . B5 . | E5 - B4 - E5 - . .'
    ],
    bass: 'E2 E3 . E2 G2 . E2 B1 | C2 C3 . C2 D2 . D3 D2 | E2 E3 . E2 G2 . A2 G2 | B1 B2 . B1 B1 D2 F#2 B1',
    drums: 'k . h s . k s h | k h . s k . s o'
  };
})(window.Arcade = window.Arcade || {});

/* ОПЕРАЦИЯ · музыка: оригинальная тема студии «Гефест» для секвенсора движка (engine.js ≥ 2.1).
   Характер: неторопливый «штабной» марш в ре миноре, 104 BPM — сдержанная мелодия с вопросительными
   подъёмами к ля и ответами вниз; бас ходит D → Bb → F → A (с хроматическим подходом в конце фразы),
   ударные — мерный шаг с малым на слабых долях. 8 тактов мелодии на 4 такта баса.
   Подключается сама: трек кладётся в Arcade.tracks.operatsiya, движок берёт его по gameId. */
(function (A) {
  'use strict';
  A.tracks = A.tracks || {};
  A.tracks.operatsiya = {
    bpm: 104, div: 2, vol: 0.7, lead: { retro: 'square', modern: 'triangle' },
    melody: [
      'D5 - . F5 E5 . D5 . | A4 - . . C5 D5 E5 . | F5 - E5 D5 C5 - A4 . | D5 - - . . . . .',
      'A4 . A4 C5 D5 . F5 . | G5 - F5 E5 D5 - . . | C5 . D5 E5 F5 E5 D5 C5 | D5 - - . A4 - - .'
    ],
    bass: 'D3 . D3 A2 D3 . F3 . | Bb2 . Bb2 F2 Bb2 . D3 . | F2 . F2 C3 F2 . A2 . | A2 . A2 E3 A2 . C#3 .',
    drums: 'k . h . s . h . | k . h k s . h h'
  };
})(window.Arcade = window.Arcade || {});

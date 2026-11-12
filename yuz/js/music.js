/* ЮЗ · музыка: оригинальная драйвовая тема студии «Гефест» для секвенсора движка (engine.js ≥ 2.1).
   Характер: быстрый «гоночный» ми минор — бегущие восьмые в мелодии, октавный бас «мотором»,
   прямая бочка и малый на 2 и 4. 8 тактов мелодии на 4 такта баса.
   Подключается сама: трек кладётся в Arcade.tracks.yuz, движок берёт его по gameId. */
(function (A) {
  'use strict';
  A.tracks = A.tracks || {};
  A.tracks.yuz = {
    bpm: 168, div: 2, vol: 0.75, lead: { retro: 'square', modern: 'triangle' },
    melody: [
      'E5 . G5 E5 B5 . A5 G5 | F#5 . D5 . E5 - - . | E5 . G5 B5 D6 . C6 B5 | A5 - F#5 . G5 . F#5 .',
      'C6 . B5 A5 G5 . A5 B5 | E5 . G5 . B5 - A5 . | G5 A5 B5 D6 E6 . D6 B5 | B5 - - . E5 . . .'
    ],
    bass: 'E2 E3 E2 E3 E2 E3 D3 E3 | C2 C3 C2 C3 C2 C3 B2 C3 | D2 D3 D2 D3 D2 D3 F#2 D3 | B1 B2 B1 B2 D#3 B2 F#2 B2',
    drums: 'k h s h k k s h | k h s h k h s o'
  };
})(window.Arcade = window.Arcade || {});

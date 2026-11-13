/* ШУСТРИК · музыка: оригинальная тема студии «Гефест» для секвенсора движка (engine.js ≥ 2.1).
   Характер: быстрый бодрый «гон» в ре мажоре на 168 ударов, бас прыгающими октавами, мелодия —
   скачущие арпеджио с синкопой и восходящим «разгоном» в конце фразы. 8 тактов мелодии на 4 такта баса.
   Подключается сама: трек кладётся в Arcade.tracks.shustrik, движок берёт его по gameId. */
(function (A) {
  'use strict';
  A.tracks = A.tracks || {};
  A.tracks.shustrik = {
    bpm: 168, div: 2, vol: 0.8, lead: { retro: 'square', modern: 'triangle' },
    melody: [
      'D5 . A4 D5 F#5 - E5 D5 | B4 - D5 . E5 - . . | G5 . F#5 E5 D5 - B4 A4 | B4 - A4 - F#4 - . .',
      'D5 . A4 D5 F#5 - A5 . | G5 - F#5 . E5 - D5 . | E5 . F#5 . G5 . A5 . | B5 - A5 - D6 - . .'
    ],
    bass: 'D2 D3 D2 D3 D2 D3 A2 C#3 | B1 B2 B1 B2 G2 G2 A2 A2 | G1 G2 G1 G2 D2 D3 D2 D3 | A1 A2 A1 A2 E2 F#2 G2 A2',
    drums: 'k h s h k k s h | k h s h k h s o'
  };
})(window.Arcade = window.Arcade || {});

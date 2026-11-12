/* ФИТИЛЬ · музыка: оригинальная тема студии «Гефест» для секвенсора движка (engine.js ≥ 2.1).
   Характер: тревожно-бодрая «тикающая» тема ре минор — короткие стаккато, как искра бежит по шнуру,
   бас с синкопой и хэт «тик-так». 8 тактов мелодии на 4 такта баса.
   Подключается сама: трек кладётся в Arcade.tracks.fitil, движок берёт его по gameId. */
(function (A) {
  'use strict';
  A.tracks = A.tracks || {};
  A.tracks.fitil = {
    bpm: 150, div: 2, vol: 0.8, lead: { retro: 'square', modern: 'triangle' },
    melody: [
      'D5 . F5 D5 A5 . G5 F5 | E5 . C5 . D5 - - . | D5 . F5 A5 C6 . Bb5 A5 | G5 - E5 . F5 . E5 .',
      'A5 . A5 G5 F5 . E5 D5 | C5 . E5 . G5 - F5 . | E5 F5 G5 A5 Bb5 . A5 G5 | A5 - - . D5 . . .'
    ],
    bass: 'D2 . D3 . . D2 C3 . | Bb1 . Bb2 . . Bb1 A2 . | G1 . G2 . . G1 A2 . | A1 . A2 . C#3 . E3 .',
    drums: 'k h . h s h . h | k h k h s h o h'
  };
})(window.Arcade = window.Arcade || {});

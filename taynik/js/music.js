/* ТАЙНИК · музыка: оригинальная тема студии «Гефест» для секвенсора движка (engine.js ≥ 2.1).
   Характер: настороженный ре минор — «капающая» мелодия с паузами, как шаги по пустой башне,
   бас-остинато восьмыми, редкий хэт. 8 тактов мелодии на 4 такта баса.
   Подключается сама: трек кладётся в Arcade.tracks.taynik, движок берёт его по gameId. */
(function (A) {
  'use strict';
  A.tracks = A.tracks || {};
  A.tracks.taynik = {
    bpm: 112, div: 2, vol: 0.8, lead: { retro: 'square', modern: 'triangle' },
    melody: [
      'D5 . F5 . A5 - G5 . | F5 . E5 . D5 - . . | C5 . E5 . G5 - F5 . | E5 . C5 . A4 - . .',
      'Bb4 . D5 . F5 - E5 . | D5 . C#5 . E5 - . . | D5 . A4 . F5 . E5 . | D5 - - . . . A4 .'
    ],
    bass: 'D3 D3 A2 A2 D3 D3 F2 A2 | C3 C3 G2 G2 C3 C3 E2 G2 | Bb2 Bb2 F2 F2 Bb2 Bb2 D3 F2 | A2 A2 E2 E2 A2 A2 C#3 E2',
    drums: 'k . h . s . h . | k . h k s . h o'
  };
})(window.Arcade = window.Arcade || {});

/* ЛИВЕНЬ · музыка: оригинальная тема студии «Гефест» для секвенсора движка (engine.js ≥ 2.1).
   Характер: быстрый грозовой ход ре минор — мелодия взлетает арпеджио к верхнему ре, будто искра пробивает облака,
   во второй половине поднимается к фа и падает вниз «каплями»; бас пульсирует восьмыми с квинтовым отскоком.
   8 тактов мелодии на 4 такта баса. Подключается сама: Arcade.tracks.liven, движок берёт трек по gameId. */
(function (A) {
  'use strict';
  A.tracks = A.tracks || {};
  A.tracks.liven = {
    bpm: 152, div: 2, vol: 0.7, lead: { retro: 'square', modern: 'triangle' },
    melody: [
      'D5 . F5 A5 D6 - C6 A5 | Bb5 - A5 G5 F5 - E5 . | F5 . G5 A5 C6 - A5 F5 | G5 - - . A5 . E5 .',
      'D5 . F5 A5 D6 - E6 F6 | E6 - D6 C6 Bb5 - A5 . | G5 A5 Bb5 . A5 G5 F5 E5 | D5 - - - A4 . . .'
    ],
    bass: 'D3 . D3 A2 D3 . C3 . | Bb2 . Bb2 F2 Bb2 . A2 . | F2 . F2 C3 F2 . G2 . | A2 . A2 E2 A2 . C#3 .',
    drums: 'k . h k s . h h | k . h k s h o .'
  };
})(window.Arcade = window.Arcade || {});

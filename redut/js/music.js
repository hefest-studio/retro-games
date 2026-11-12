/* РЕДУТ · музыка: оригинальная тема студии «Гефест» для секвенсора движка (engine.js ≥ 2.1).
   Характер: строевой марш ре минор — чёткий бас на сильные доли, малый барабан «дробью». 8 тактов.
   Подключается сама: трек кладётся в Arcade.tracks.redut, движок берёт его по gameId. */
(function (A) {
  'use strict';
  A.tracks = A.tracks || {};
  A.tracks.redut = {
    bpm: 126, div: 2, vol: 0.9, lead: { retro: 'square', modern: 'triangle' },
    melody: [
      'D5 - A4 - D5 E5 F5 - | E5 - D5 - C5 - A4 - | Bb4 - D5 - F5 - E5 D5 | E5 - - - A4 - - -',
      'F5 - E5 F5 G5 - F5 E5 | D5 - C5 D5 E5 - A4 - | Bb4 - C5 - D5 E5 F5 G5 | A5 - E5 - D5 - - -'
    ],
    bass: 'D2 . D3 . A2 . D3 . | Bb1 . Bb2 . F2 . Bb2 . | C2 . C3 . G2 . C3 . | A1 . A2 . E2 . A2 .',
    drums: 'k . s . k k s . | k . s . k . s s'
  };
})(window.Arcade = window.Arcade || {});

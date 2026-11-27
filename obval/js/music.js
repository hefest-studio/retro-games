/* ОБВАЛ · музыка: оригинальная тема студии «Гефест» для секвенсора движка (engine.js ≥ 2.1).
   Характер: подземелье — мрачный ми-фригийский, глухой бас и «стук крепи» на малом барабане. 8 тактов.
   Подключается сама: трек кладётся в Arcade.tracks.obval, движок берёт его по gameId. */
(function (A) {
  'use strict';
  A.tracks = A.tracks || {};
  A.tracks.obval = {
    bpm: 108, div: 2, vol: 0.9, lead: { retro: 'square', modern: 'triangle' },
    melody: [
      'E4 . B4 . A4 G4 F4 E4 | E4 - - . G4 . F4 E4 | D4 . F4 . A4 . G4 F4 | E4 - - - . . . .',
      'E4 . G4 B4 E5 . D5 B4 | C5 - B4 A4 G4 - F4 . | A4 . C5 . B4 . A4 G4 | E4 - - - . . . .'
    ],
    bass: [
      'E2 . E2 . E2 . B2 . | E2 . E2 . G2 . F2 . | D2 . D2 . D2 . A2 . | E2 . E2 . B2 . E2 .'
    ],
    drums: 'k . h . s . h k | . k h . s . h .'
  };
})(window.Arcade = window.Arcade || {});

/* КАСКАД · музыка: оригинальная тема студии «Гефест» для секвенсора движка (engine.js ≥ 2.1).
   Характер: собранный «марш» в ре миноре — ровный, упрямый, под падающие фигуры. 8 тактов. */
(function (A) {
  'use strict';
  A.tracks = A.tracks || {};
  A.tracks.kaskad = {
    bpm: 138, div: 2,
    melody: [
      'D5 - A4 - F4 G4 A4 - | C5 - Bb4 A4 G4 - F4 - | E4 F4 G4 - A4 - D5 - | C5 - A4 - - - . .',
      'F5 - E5 D5 C5 - D5 - | Bb4 - A4 G4 A4 - F4 - | G4 A4 Bb4 - A4 G4 F4 E4 | D4 - - - . . . .'
    ],
    bass: [
      'D3 . A2 . D3 . A2 . | Bb2 . F2 . Bb2 . F2 . | C3 . G2 . C3 . G2 . | F2 . C3 . F2 . C3 .',
      'D3 . A2 . D3 . A2 . | G2 . D3 . G2 . D3 . | A2 . E3 . A2 . C#3 . | D3 . A2 . D2 . . .'
    ],
    drums: 'k . h . s . h . | k . h k s . h h'
  };
})(window.Arcade = window.Arcade || {});

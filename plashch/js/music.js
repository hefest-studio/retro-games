/* ПЛАЩ · музыка: оригинальная тема студии «Гефест» для секвенсора движка (engine.js ≥ 2.1).
   Характер: таинственный ре дорийский, длинные ноты и редкий бит — ночные крыши. 8 тактов. */
(function (A) {
  'use strict';
  A.tracks = A.tracks || {};
  A.tracks.plashch = {
    bpm: 112, div: 2, lead: { retro: 'square', modern: 'sine' },
    melody: [
      'D5 - - - A4 - C5 - | D5 - E5 - F5 - E5 - | D5 - - - C5 - A4 - | G4 - - - - - . .',
      'F5 - - - E5 - D5 - | E5 - G5 - A5 - - - | G5 - F5 - E5 - C5 - | D5 - - - - - . .'
    ],
    bass: [
      'D3 . . . D3 . A2 . | G2 . . . G2 . D3 . | D3 . . . D3 . A2 . | G2 . . . G2 . B2 .',
      'D3 . . . D3 . F3 . | C3 . . . C3 . G2 . | G2 . . . G2 . A2 . | D3 . . . D2 . . .'
    ],
    drums: 'k . . h s . . h | k . h . s . . h'
  };
})(window.Arcade = window.Arcade || {});

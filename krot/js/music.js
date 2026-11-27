/* МУРАВЕЙНИК · музыка: оригинальная тема студии «Гефест» для секвенсора движка — деловитый «семенящий» марш ре минор:
   пиццикато-мелодия бежит мелкими нотами, бас шагает по тонике и квинте. Ключ = gameId (krot). */
(function (A) {
  'use strict';
  A.tracks = A.tracks || {};
  A.tracks.krot = {
    bpm: 124, div: 2, vol: 0.7, lead: { retro: 'square', modern: 'triangle' },
    melody: [
      'D5 . F5 D5 A4 . D5 . | C5 . E5 C5 G4 . C5 . | Bb4 . D5 F5 E5 . D5 . | A4 - C#5 A4 E4 - - .',
      'F5 . A5 F5 D5 . F5 . | E5 . G5 E5 C5 . E5 . | D5 . Bb4 D5 F5 E5 D5 C5 | D5 - - . A4 . D4 .'
    ],
    bass: 'D2 . D3 . A2 . A3 . | C2 . C3 . G2 . G3 . | Bb1 . Bb2 . F2 . F3 . | A1 . A2 . A1 . E2 .',
    drums: 'k . h . s . h h | k . h k s . h .'
  };
})(window.Arcade = window.Arcade || {});

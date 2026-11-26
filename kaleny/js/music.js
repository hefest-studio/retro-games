/* КАЛЁНЫЙ ДВОР · музыка: оригинальная тема студии «Гефест» для секвенсора движка — упругий «заводской» ритм ре минор,
   бас бьёт по наковальне, мелодия подскакивает, как шар от плиты. 8 тактов мелодии на 4 такта баса. Ключ = gameId. */
(function (A) {
  'use strict';
  A.tracks = A.tracks || {};
  A.tracks.kaleny = {
    bpm: 124, div: 2, vol: 0.75, lead: { retro: 'square', modern: 'triangle' },
    melody: [
      'D4 . F4 A4 G4 . F4 . | E4 . G4 Bb4 A4 - - . | D5 . C5 A4 C5 . A4 F4 | G4 - E4 . D4 - - .',
      'F4 . A4 C5 Bb4 . A4 . | G4 . Bb4 D5 C5 - - . | D5 . E5 F5 E5 . C5 A4 | D5 - - - A4 . D4 .'
    ],
    bass: 'D2 . D3 . D2 . A2 . | Bb1 . Bb2 . F2 . F2 . | G2 . G3 . G2 . D3 . | A1 . A2 . E2 . A2 .',
    drums: 'k . h h s . h k | k . h . s h h .'
  };
})(window.Arcade = window.Arcade || {});

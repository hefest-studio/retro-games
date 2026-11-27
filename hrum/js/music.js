/* КАТЫШ · музыка: оригинальная тема студии «Гефест» для секвенсора движка — лёгкий «скользящий» ритм ля минор, мелодия катится
   вниз и подпрыгивает, бас шагает по квинтам. Ключ = gameId (hrum). */
(function (A) {
  'use strict';
  A.tracks = A.tracks || {};
  A.tracks.hrum = {
    bpm: 132, div: 2, vol: 0.7, lead: { retro: 'square', modern: 'triangle' },
    melody: [
      'A4 . C5 E5 D5 . C5 . | B4 . D5 F5 E5 - - . | C5 . B4 A4 G4 . A4 C5 | E5 - D5 . A4 - - .',
      'E5 . D5 C5 D5 . E5 . | G5 . F5 E5 D5 - - . | C5 . D5 E5 C5 . A4 . | A4 - - - E4 . A4 .'
    ],
    bass: 'A2 . A2 . E2 . E3 . | F2 . F2 . C3 . C2 . | D2 . D2 . A2 . A2 . | E2 . E3 . A2 . E2 .',
    drums: 'k . h . s . h h | k . h h s . h .'
  };
})(window.Arcade = window.Arcade || {});

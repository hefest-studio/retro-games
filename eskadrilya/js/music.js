/* ЭСКАДРИЛЬЯ · музыка: оригинальная тема студии «Гефест» для секвенсора движка (engine.js ≥ 2.1).
   Характер: бодрый лётный марш соль мажор — бас «раз-два» по тонике и квинте, мелодия-арпеджио
   с взлётом на верхнее соль и спуском к доминанте; в припеве — подъём через до мажор.
   8 тактов мелодии на 4 такта баса, маршевый малый барабан. Трек — Arcade.tracks.eskadrilya (по gameId). */
(function (A) {
  'use strict';
  A.tracks = A.tracks || {};
  A.tracks.eskadrilya = {
    bpm: 124, div: 2, vol: 0.8, lead: { retro: 'square', modern: 'triangle' },
    melody: [
      'G4 . B4 D5 G5 - D5 . | E5 . C5 . A4 - . . | F#4 . A4 D5 F#5 - D5 . | G5 - - . D5 . B4 .',
      'C5 . E5 G5 C6 - G5 . | B4 . D5 G5 B5 - A5 G5 | F#5 . E5 . D5 . C5 A4 | G4 - - - . . D4 .'
    ],
    bass: 'G2 . D3 . G2 . D3 . | C3 . G2 . C3 . G2 . | D3 . A2 . D3 . A2 . | G2 . D3 . G2 . B2 .',
    drums: 'k . s . k k s . | k . s . k . s s'
  };
})(window.Arcade = window.Arcade || {});

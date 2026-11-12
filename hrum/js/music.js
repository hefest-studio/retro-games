/* ХРУМ · музыка: оригинальная тема студии «Гефест» для секвенсора движка (engine.js ≥ 2.1).
   Характер: прыгучий мажор, «ум-па» в басу — озорная беготня по лабиринту. 8 тактов. */
(function (A) {
  'use strict';
  A.tracks = A.tracks || {};
  A.tracks.hrum = {
    bpm: 150, div: 2, vol: 0.9,
    melody: [
      'C5 . E5 . G5 . E5 . | F5 . D5 . B4 . G4 . | C5 . E5 G5 A5 . G5 . | F5 E5 D5 . G4 . . .',
      'E5 . C5 . A4 . C5 . | D5 . F5 . A5 . F5 . | E5 G5 D5 F5 C5 E5 B4 D5 | C5 . G4 . C5 . . .'
    ],
    bass: [
      'C3 . G2 . C3 . G2 . | G2 . D3 . G2 . D3 . | C3 . G2 . C3 . G2 . | G2 . D3 . B2 . G2 .',
      'A2 . E3 . A2 . E3 . | D3 . A2 . D3 . A2 . | G2 . D3 . G2 . B2 . | C3 . G2 . C2 . . .'
    ],
    drums: 'k . h . s . h . | k . h . s . h s'
  };
})(window.Arcade = window.Arcade || {});

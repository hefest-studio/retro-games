/* КОЛОБОК · музыка: оригинальная тема студии «Гефест» для секвенсора движка (engine.js ≥ 2.1).
   Характер: катящийся плясовой соль мажор на 6/8 (div 3) — простодушно и весело. 8 тактов. */
(function (A) {
  'use strict';
  A.tracks = A.tracks || {};
  A.tracks.kolobok = {
    bpm: 100, div: 3, lead: { retro: 'triangle', modern: 'triangle' },
    melody: [
      'G4 - B4 D5 - B4 | C5 - E5 D5 - B4 | A4 - C5 B4 - G4 | A4 - - D4 - -',
      'G4 - B4 D5 - G5 | F#5 - E5 D5 - C5 | B4 - A4 C5 - F#4 | G4 - - - . .'
    ],
    bass: [
      'G2 . . D3 . . | C3 . . G2 . . | A2 . . G2 . . | D3 . . A2 . .',
      'G2 . . D3 . . | D3 . . F#2 . . | D3 . . D2 . . | G2 . . G2 . .'
    ],
    drums: 'k . h s . h'
  };
})(window.Arcade = window.Arcade || {});

/* МЕДНИЦА · музыка: оригинальная тема студии «Гефест» для секвенсора движка (engine.js ≥ 2.1).
   Характер: неспешный «мастеровой» вальс ре мажор на 3/4 — мягкий, не утомляет в долгой сессии; 8 тактов. */
(function (A) {
  'use strict';
  A.tracks = A.tracks || {};
  A.tracks.mednitsa = {
    bpm: 104, div: 3, vol: 0.55, lead: { retro: 'square', modern: 'triangle' },
    melody: [
      'D5 - - F#5 . A5 | G5 - - E5 . . | F#5 - - D5 . A4 | B4 - - - . . |',
      'G4 . B4 D5 - B4 | A4 - - F#4 . . | E4 . G4 B4 - A4 | D5 - - - . . |'
    ],
    bass: 'D3 . . A2 . . | G2 . . D3 . . | D3 . . F#2 . . | G2 . . A2 . . |',
    drums: 'k . . h . h | k . . h . h | k . . h . h | k . . s . h |'
  };
})(window.Arcade = window.Arcade || {});

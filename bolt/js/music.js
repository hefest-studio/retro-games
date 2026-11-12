/* БОЛТ · музыка: оригинальная тема студии «Гефест» для секвенсора движка (engine.js ≥ 2.1).
   Характер: напористый ми минор, октавный бас восьмыми — побег под огнём. 8 тактов. */
(function (A) {
  'use strict';
  A.tracks = A.tracks || {};
  A.tracks.bolt = {
    bpm: 160, div: 2, lead: { retro: 'square', modern: 'sawtooth' },
    melody: [
      'E5 - - B4 E5 F#5 G5 - | F#5 E5 D5 - B4 - - - | C5 - E5 - G5 - E5 C5 | D5 - F#5 - A5 - F#5 D5',
      'B5 - A5 G5 F#5 - E5 - | G5 - F#5 E5 D5 - B4 - | C5 E5 G5 C6 B5 G5 E5 C5 | B4 - D#5 - F#5 - B5 -'
    ],
    bass: [
      'E2 E3 E2 E3 E2 E3 E2 E3 | E2 E3 E2 E3 E2 E3 E2 E3 | C2 C3 C2 C3 C2 C3 C2 C3 | D2 D3 D2 D3 D2 D3 D2 D3',
      'E2 E3 E2 E3 E2 E3 E2 E3 | E2 E3 E2 E3 E2 E3 E2 E3 | C2 C3 C2 C3 C2 C3 C2 C3 | B1 B2 B1 B2 B1 B2 B1 B2'
    ],
    drums: 'k h s h k k s h | k h s h k k s o'
  };
})(window.Arcade = window.Arcade || {});

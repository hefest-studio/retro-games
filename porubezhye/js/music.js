/* ПОРУБЕЖЬЕ · музыка: оригинальная тема студии «Гефест» для секвенсора движка.
   Характер: северный напев — ля-дорийский лад, неспешный шаг, гулкий бас. 8 тактов. */
(function (A) {
  'use strict';
  A.tracks = A.tracks || {};
  A.tracks.porubezhye = {
    bpm: 96, div: 2, vol: 0.6, lead: { retro: 'square', modern: 'triangle' },
    melody: [
      'A4 - C5 D5 E5 - D5 C5 | D5 - - B4 G4 - A4 - | A4 - C5 D5 E5 - G5 F#5 | E5 - - - - - . .',
      'G5 - E5 D5 E5 - A4 B4 | C5 - B4 A4 G4 - E4 - | A4 - B4 C5 D5 - C5 B4 | A4 - - - - - . .'
    ],
    bass: 'A2 . E3 . A2 . E3 . | G2 . D3 . G2 . D3 . | F2 . C3 . F2 . C3 . | E2 . B2 . E2 . E3 .',
    drums: 'k . . h s . . h | k . k h s . . h'
  };
})(window.Arcade = window.Arcade || {});

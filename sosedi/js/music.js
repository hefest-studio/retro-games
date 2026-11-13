/* СОСЕДИ · музыка: оригинальная весёлая тема студии «Гефест» для секвенсора движка (engine.js ≥ 2.1).
   Arcade.tracks.sosedi — «ярмарочная полька» (соль мажор, 156 уд/мин, 8 тактов мелодии на 8 тактов баса, без цитат).
   Arcade.tracks['sosedi:boss'] — тревожный, но смешной марш для уровней с боссом;
   Arcade.tracks['sosedi:bonus'] — карусельный вальс 3/4 (шестые доли) для бонус-уровней. main.js переключает трек. */
(function (A) {
  'use strict';
  A.tracks = A.tracks || {};
  A.tracks.sosedi = {
    bpm: 156, div: 2, vol: 0.85, lead: { retro: 'square', modern: 'triangle' },
    melody: [
      'G4 B4 D5 G5 F#5 - E5 D5 | C5 E5 G5 - E5 . C5 . | D5 . F#5 A5 G5 F#5 E5 D5 | B4 - D5 - G4 - . .',
      'E5 . G5 . C6 B5 A5 G5 | F#5 . A5 . D5 - . . | G5 F#5 E5 D5 C5 B4 A4 G4 | A4 B4 C5 D5 G4 - . .'
    ],
    bass: 'G2 . D3 . G2 . D3 . | C3 . G2 . C3 . G2 . | D3 . A2 . D3 . A2 . | G2 . D3 . G2 B2 D3 . | C3 . G2 . C3 . G2 . | D3 . A2 . D3 . F#2 . | E2 . B2 . C3 . A2 . | D3 . D2 . G2 . . .',
    drums: 'k . h s k h s h | k . h s k k s o'
  };
  A.tracks['sosedi:boss'] = {
    bpm: 168, div: 2, vol: 0.85, lead: { retro: 'square', modern: 'triangle' },
    melody: [
      'D5 . D5 F5 E5 . D5 . | C#5 - A4 - . . . . | D5 . D5 F5 G5 . A5 . | Bb5 - A5 - G5 - E5 -',
      'F5 . F5 A5 G5 . F5 . | E5 - C#5 - . . A4 . | D5 E5 F5 G5 A5 G5 F5 E5 | D5 - A4 - D5 - . .'
    ],
    bass: 'D2 D3 D2 D3 A1 A2 A1 A2 | D2 D3 D2 D3 G1 G2 A1 A2',
    drums: 'k h s h k h s h | k k s h k h s s'
  };
  A.tracks['sosedi:bonus'] = {
    bpm: 150, div: 3, vol: 0.85, lead: { retro: 'square', modern: 'triangle' },
    melody: [
      'C5 - E5 G5 - E5 | A5 - G5 E5 - C5 | D5 - F5 A5 - F5 | G5 - - . . .',
      'E5 - G5 C6 - G5 | A5 - F5 D5 - B4 | C5 - E5 D5 - B4 | C5 - - . . .'
    ],
    bass: 'C3 . G2 C3 . G2 | F2 . C3 G2 . D3',
    drums: 'k . h s . h'
  };
})(window.Arcade = window.Arcade || {});

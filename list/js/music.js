/* ЛИСТ · музыка: оригинальные темы студии «Гефест» для секвенсора движка (engine.js ≥ 2.1).
   Arcade.tracks.list — основная тема («печатный станок», ре дорийский, 138 уд/мин; звучит в главе 1).
   Arcade.tracks['list:2'] — переплётная (тяжёлый шаг в ми миноре), ['list:3'] — корректорская (тревожный 6/8),
   ['list:boss'] — бой с боссом главы. main.js переключает тему g.setMusic(...) на событиях page/bossIn.
   Все мелодии — 8 тактов, без цитат. */
(function (A) {
  'use strict';
  A.tracks = A.tracks || {};
  A.tracks.list = {
    bpm: 138, div: 2, vol: 0.85, lead: { retro: 'square', modern: 'triangle' },
    melody: [
      'D5 . F5 G5 A5 - G5 F5 | E5 . C5 . D5 - . . | A4 . C5 D5 E5 - F5 E5 | D5 C5 A4 . C5 - . .',
      'D5 . F5 G5 A5 - C6 B5 | A5 G5 F5 . G5 - . . | F5 E5 D5 C5 A4 . C5 . | D5 - - . D5 . . .'
    ],
    bass: 'D2 . D3 . A2 . D3 . | C2 . C3 . G2 . C3 . | A1 . A2 . E2 . A2 . | D2 . D3 . C3 . A2 .',
    drums: 'k . h s k k s h | k . h s k h s o'
  };
  A.tracks['list:2'] = {
    bpm: 120, div: 2, vol: 0.85, lead: { retro: 'square', modern: 'triangle' },
    melody: [
      'E5 - B4 . E5 F#5 G5 - | F#5 E5 D5 . B4 - . . | C5 - G4 . C5 D5 E5 - | D5 C5 B4 . A4 - B4 .',
      'E5 - G5 . B5 - A5 G5 | F#5 - D5 . F#5 - E5 . | C5 - E5 . G5 - F#5 E5 | D#5 - B4 . E5 - . .'
    ],
    bass: 'E2 . E2 B2 E2 . E2 B2 | C2 . C2 G2 C2 . D2 . | A1 . A1 E2 A1 . A1 E2 | B1 . B1 F#2 B1 . B1 .',
    drums: 'k . s . k k s . | k . s h k . s s'
  };
  A.tracks['list:3'] = {
    bpm: 150, div: 3, vol: 0.85, lead: { retro: 'square', modern: 'sine' },
    melody: [
      'G5 . F5 Eb5 - D5 | C5 - . G4 . . | Ab4 C5 Eb5 G5 - F5 | D5 - - . . . | G5 . F5 Eb5 - F5 | G5 - Ab5 G5 - . | F5 Eb5 D5 C5 . B4 | C5 - - . . .',
      'Eb5 . D5 C5 - Bb4 | Ab4 - . C5 . . | F5 . Eb5 D5 - C5 | B4 - - G4 . . | C5 Eb5 G5 C6 - Bb5 | Ab5 - G5 F5 - . | Eb5 D5 C5 D5 . B4 | C5 - - . . .'
    ],
    bass: 'C2 . G2 C3 . G2 | Ab1 . Eb2 Ab2 . Eb2 | F1 . C2 F2 . C2 | G1 . D2 G2 . B1',
    drums: 'k . h s . h | k . h s h h'
  };
  A.tracks['list:boss'] = {
    bpm: 164, div: 2, vol: 0.85, lead: { retro: 'square', modern: 'triangle' },
    melody: [
      'A4 A4 C5 A4 D5 A4 E5 A4 | F5 E5 D5 C5 B4 - G#4 . | A4 A4 C5 A4 D5 A4 F5 A4 | E5 - - . E5 F5 E5 D5',
      'C5 C5 E5 C5 F5 C5 G5 C5 | A5 G5 F5 E5 D5 - B4 . | A4 C5 E5 A5 G#5 - E5 . | A5 - - . A4 - . .'
    ],
    bass: 'A1 A2 A1 A2 A1 A2 A1 A2 | D2 D3 D2 D3 E2 E3 E2 E3',
    drums: 'k h s h k k s h'
  };
})(window.Arcade = window.Arcade || {});

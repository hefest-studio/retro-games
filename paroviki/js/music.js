/* ПАРОВИКИ · музыка: оригинальная тема студии «Гефест» для секвенсора движка (engine.js ≥ 2.1).
   Характер: бодрый «паровой» марш в соль миноре, 138 BPM — бас качается как шатун (корень–квинта),
   мелодия из пунктирных ходов с «гудком» на сильных долях. 8 тактов мелодии на 4 такта баса.
   Подключается сама: трек кладётся в Arcade.tracks.paroviki, движок берёт его по gameId. */
(function (A) {
  'use strict';
  A.tracks = A.tracks || {};
  A.tracks.paroviki = {
    bpm: 138, div: 2, vol: 0.8, lead: { retro: 'square', modern: 'triangle' },
    melody: [
      'G4 . Bb4 D5 C5 . Bb4 A4 | G4 - D5 . F5 - Eb5 D5 | C5 . Eb5 G5 F5 . Eb5 D5 | C5 - G4 . A4 Bb4 C5 .',
      'D5 . F5 . Eb5 D5 C5 Bb4 | A4 - C5 . D5 - . . | G5 . F5 Eb5 D5 . C5 A4 | G4 - - . D4 - G4 .'
    ],
    bass: 'G2 . D3 . G2 G2 D3 . | Eb2 . Bb2 . Eb2 Eb2 Bb2 . | C2 . G2 . C2 C2 G2 . | D2 . A2 . D2 F#2 A2 D2',
    drums: 'k . h s k k h s | k . h s k h s o'
  };
})(window.Arcade = window.Arcade || {});

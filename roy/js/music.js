/* РОЙ · музыка: оригинальная тема студии «Гефест» для секвенсора движка (engine.js ≥ 2.1).
   Характер: космическая тревога — арпеджио до минора, пульсирующий бас. 8 тактов.
   Подключается сама: трек кладётся в Arcade.tracks.roy, движок берёт его по gameId. */
(function (A) {
  'use strict';
  A.tracks = A.tracks || {};
  A.tracks.roy = {
    bpm: 152, div: 2, vol: 0.85, lead: { retro: 'square', modern: 'sawtooth' },
    melody: [
      'C5 Eb5 G5 C6 G5 Eb5 C5 Eb5 | Ab4 C5 Eb5 Ab5 Eb5 C5 Ab4 C5 | Bb4 D5 F5 Bb5 F5 D5 Bb4 D5 | G4 B4 D5 G5 F5 D5 B4 G4',
      'C6 - Bb5 - G5 - Eb5 F5 | G5 - - Ab5 G5 F5 Eb5 - | F5 - - G5 F5 Eb5 D5 - | B4 - D5 - G5 - - -'
    ],
    bass: [
      'C2 C3 C2 C3 C2 C3 C2 C3 | Ab1 Ab2 Ab1 Ab2 Ab1 Ab2 Ab1 Ab2 | Bb1 Bb2 Bb1 Bb2 Bb1 Bb2 Bb1 Bb2 | G1 G2 G1 G2 G1 G2 G1 G2',
      'C2 C3 C2 C3 C2 C3 C2 C3 | C2 C3 C2 C3 C2 C3 C2 C3 | Bb1 Bb2 Bb1 Bb2 Bb1 Bb2 Bb1 Bb2 | G1 G2 G1 G2 G1 G2 G1 G2'
    ],
    drums: 'k . h k s . h . | k . h k s h s h'
  };
})(window.Arcade = window.Arcade || {});
